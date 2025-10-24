const db = require('../models');
const { Op } = require('sequelize');

/**
 * ============================================
 * CONTROLADOR DE ANALYTICS - VERSIÓN REFACTORIZADA
 * ============================================
 * 
 * Estrategia:
 * 1. Todos los eventos van a analytics_events (tabla maestra)
 * 2. Procesamiento específico según event_type
 * 3. Transacciones para integridad
 * 4. Caché de usuarios para performance
 */

/**
 * Caché de usuarios en memoria durante el procesamiento del batch
 */
let userCache = {};

/**
 * Endpoint principal para recibir eventos de analytics
 * POST /api/analytics
 */
const receiveEvents = async (req, res) => {
    const startTime = Date.now();
    
    try {
        const { events } = req.body;
        
        // Validar que llegó un array de eventos
        if (!events || !Array.isArray(events)) {
            return res.status(400).json({ 
                error: 'Se esperaba un array de eventos en el campo "events"' 
            });
        }

        if (events.length === 0) {
            return res.status(200).json({ 
                message: 'No hay eventos para procesar',
                processed: 0 
            });
        }

        console.log(`\n📥 BATCH RECIBIDO: ${events.length} eventos`);
        
        // Contar eventos por tipo
        const eventCounts = {};
        events.forEach(e => {
            eventCounts[e.event_type] = (eventCounts[e.event_type] || 0) + 1;
        });
        console.log('📊 Eventos por tipo:', eventCounts);

        // Limpiar caché de usuarios
        userCache = {};

        // Estadísticas del procesamiento
        let successCount = 0;
        let errorCount = 0;
        const errorDetails = [];

        // Iniciar transacción
        const transaction = await db.sequelize.transaction();

        try {
            // FASE 1: Mapear TODOS los usuarios únicos del batch
            await mapAllUsersInBatch(events, transaction);

            // FASE 2: Procesar cada evento
            for (const event of events) {
                try {
                    // Validar estructura básica
                    if (!validateEvent(event)) {
                        throw new Error('Evento con estructura inválida');
                    }

                    // Guardar en analytics_events (SIEMPRE)
                    await saveToAnalyticsEvents(event, transaction);

                    // Procesamiento específico según tipo
                    await processSpecificEvent(event, transaction);

                    successCount++;
                    
                } catch (eventError) {
                    errorCount++;
                    errorDetails.push({
                        event_id: event.event_id,
                        event_type: event.event_type,
                        error: eventError.message
                    });
                    console.error(`❌ Error en evento ${event.event_id}:`, eventError.message);
                }
            }

            // Si hubo demasiados errores, hacer rollback
            if (errorCount > events.length * 0.5) { // Más del 50% falló
                throw new Error(`Demasiados errores: ${errorCount}/${events.length}`);
            }

            // Commit de la transacción
            await transaction.commit();

            const processingTime = Date.now() - startTime;
            console.log(`✅ Procesamiento completado en ${processingTime}ms`);
            console.log(`   Exitosos: ${successCount}`);
            console.log(`   Errores: ${errorCount}`);

            return res.status(200).json({
                message: 'Eventos procesados',
                stats: {
                    total: events.length,
                    success: successCount,
                    errors: errorCount,
                    processing_time_ms: processingTime
                },
                error_details: errorCount > 0 ? errorDetails : undefined
            });

        } catch (transactionError) {
            // Rollback en caso de error
            await transaction.rollback();
            throw transactionError;
        }

    } catch (error) {
        console.error('❌ ERROR GENERAL:', error);
        return res.status(500).json({ 
            error: 'Error al procesar eventos',
            details: error.message 
        });
    }
};

/**
 * Valida la estructura básica de un evento
 */
/**
 * Valida la estructura básica de un evento
 */
function validateEvent(event) {
    if (!event || typeof event !== 'object') {
        console.log('❌ Validación falló: evento no es un objeto válido');
        console.log('   Tipo recibido:', typeof event);
        console.log('   Contenido:', JSON.stringify(event).substring(0, 200));
        return false;
    }
    
    if (!event.event_id) {
        console.log('❌ Validación falló: falta event_id');
        console.log('   Evento recibido:', JSON.stringify(event).substring(0, 500));
        return false;
    }
    
    if (!event.event_type) {
        console.log('❌ Validación falló: falta event_type');
        console.log('   Evento recibido:', JSON.stringify(event).substring(0, 500));
        return false;
    }
    
    if (!event.timestamp) {
        console.log('❌ Validación falló: falta timestamp');
        console.log('   Evento recibido:', JSON.stringify(event).substring(0, 500));
        return false;
    }
    
    return true;
}

/**
 * Mapea todos los usuarios únicos del batch en una sola pasada
 */
async function mapAllUsersInBatch(events, transaction) {
    const uniqueEmails = new Set();

    // Recolectar todos los emails únicos
    events.forEach(event => {
        if (event.active_user_email) uniqueEmails.add(event.active_user_email);
        if (event.driver_email) uniqueEmails.add(event.driver_email);
        if (event.navigator_email) uniqueEmails.add(event.navigator_email);
        
        // También del data (por si acaso)
        if (event.data?.author_email) uniqueEmails.add(event.data.author_email);
        if (event.data?.driver_email) uniqueEmails.add(event.data.driver_email);
        if (event.data?.navigator_email) uniqueEmails.add(event.data.navigator_email);
    });

    console.log(`👥 Mapeando ${uniqueEmails.size} usuarios únicos...`);

    // Buscar usuarios existentes
    const existingUsers = await db.User.findAll({
        where: {
            email: { [Op.in]: Array.from(uniqueEmails) }
        },
        attributes: ['user_id', 'email'],
        transaction
    });

    // Agregar a caché
    existingUsers.forEach(user => {
        userCache[user.email] = user.user_id;
    });

    // Crear usuarios que no existen
    const existingEmails = existingUsers.map(u => u.email);
    const newEmails = Array.from(uniqueEmails).filter(email => !existingEmails.includes(email));

    if (newEmails.length > 0) {
        const newUsers = newEmails.map(email => ({
            email: email,
            university_domain: email.split('@')[1] || null,
            created_at: new Date()
        }));

        const createdUsers = await db.User.bulkCreate(newUsers, {
            transaction,
            returning: true
        });

        // Agregar nuevos usuarios a caché
        createdUsers.forEach(user => {
            userCache[user.email] = user.user_id;
        });

        console.log(`   ✅ ${newEmails.length} usuarios nuevos creados`);
    }

    console.log(`   ✅ Cache de usuarios lista: ${Object.keys(userCache).length} usuarios`);
}

/**
 * Obtiene user_id del caché
 */
function getUserId(email) {
    if (!email) return null;
    return userCache[email] || null;
}

/**
 * Guarda el evento en la tabla analytics_events
 */
async function saveToAnalyticsEvents(event, transaction) {
    // Mapear usuarios
    const userId = getUserId(event.active_user_email);
    const driverUserId = getUserId(event.driver_email);
    const navigatorUserId = getUserId(event.navigator_email);

    const analyticsEvent = {
        event_id: event.event_id,
        event_type: event.event_type,
        user_id: userId,
        session_id: event.session_id || null,
        timestamp: new Date(event.timestamp),
        data: event.data || {},
        driver_user_id: driverUserId,
        navigator_user_id: navigatorUserId,
        conversation_id: event.conversation_id || null,
        pair_session_id: event.pair_session_id || null
    };

    await db.AnalyticsEvent.create(analyticsEvent, { transaction });
}

/**
 * Procesa el evento según su tipo específico
 */
async function processSpecificEvent(event, transaction) {
    switch (event.event_type) {
        case 'PAIR_SESSION_START':
            await processPairSessionStart(event, transaction);
            break;

        case 'PAIR_ROLE_SWITCH':
            await processPairRoleSwitch(event, transaction);
            break;

        case 'PAIR_SESSION_END':
            await processPairSessionEnd(event, transaction);
            break;

        case 'CHAT_INTERACTION':
            await processChatInteraction(event, transaction);
            break;

        case 'CODE_SNAPSHOT':
            await processCodeSnapshot(event, transaction);
            break;

        case 'TASK_CREATE':
            await processTaskCreate(event, transaction);
            break;

        case 'TASK_COMPLETE':
            await processTaskComplete(event, transaction);
            break;

        case 'CODE_ANALYSIS_RESULT':
            await processCodeAnalysis(event, transaction);
            break;

        default:
            // Otros eventos solo van a analytics_events
            console.log(`   ℹ️  ${event.event_type} guardado solo en analytics_events`);
            break;
    }
}

/**
 * Procesa PAIR_SESSION_START
 */
async function processPairSessionStart(event, transaction) {
    const driverUserId = getUserId(event.driver_email);
    const navigatorUserId = getUserId(event.navigator_email);

    if (!driverUserId || !navigatorUserId) {
        throw new Error('No se pudieron mapear driver o navigator');
    }

    // Buscar si ya existe (por si hay duplicados)
    const existing = await db.PairProgrammingSession.findOne({
        where: { pair_session_id: event.pair_session_id },
        transaction
    });

    if (existing) {
        console.log(`   ⚠️  Sesión ${event.pair_session_id} ya existe, actualizando...`);
        await existing.update({
            start_time: new Date(event.timestamp),
            driver_id: driverUserId,
            navigator_id: navigatorUserId,
            current_driver_id: driverUserId
        }, { transaction });
    } else {
        await db.PairProgrammingSession.create({
            session_id: event.session_id || event.pair_session_id,
            pair_session_id: event.pair_session_id,
            driver_id: driverUserId,
            navigator_id: navigatorUserId,
            current_driver_id: driverUserId,
            start_time: new Date(event.timestamp),
            expected_duration_minutes: event.data?.expected_duration_minutes || 60,
            workspace_name: event.data?.workspace_name || null
        }, { transaction });
        
        console.log(`   ✅ Sesión de pair programming creada: ${event.pair_session_id}`);
    }
}

/**
 * Procesa PAIR_ROLE_SWITCH
 */
async function processPairRoleSwitch(event, transaction) {
    if (!event.pair_session_id) {
        console.log(`   ⚠️  ROLE_SWITCH sin pair_session_id, omitiendo...`);
        return;
    }

    // Buscar la sesión
    const session = await db.PairProgrammingSession.findOne({
        where: { pair_session_id: event.pair_session_id },
        transaction
    });

    if (!session) {
        console.log(`   ⚠️  Sesión ${event.pair_session_id} no encontrada para ROLE_SWITCH`);
        return;
    }

    // Actualizar sesión
    const newDriverId = getUserId(event.data?.new_driver || event.driver_email);
    await session.update({
        current_driver_id: newDriverId,
        total_role_switches: (session.total_role_switches || 0) + 1
    }, { transaction });

    // Crear registro de cambio de rol
    await db.RoleSwitch.create({
        pp_session_id: session.pp_session_id,
        timestamp: new Date(event.timestamp),
        previous_driver: getUserId(event.data?.previous_driver),
        new_driver: newDriverId
    }, { transaction });

    console.log(`   ✅ Cambio de rol registrado en sesión ${event.pair_session_id}`);
}

/**
 * Procesa PAIR_SESSION_END
 */
async function processPairSessionEnd(event, transaction) {
    if (!event.pair_session_id) {
        console.log(`   ⚠️  SESSION_END sin pair_session_id, omitiendo...`);
        return;
    }

    const session = await db.PairProgrammingSession.findOne({
        where: { pair_session_id: event.pair_session_id },
        transaction
    });

    if (!session) {
        console.log(`   ⚠️  Sesión ${event.pair_session_id} no encontrada para SESSION_END`);
        return;
    }

    await session.update({
        end_time: new Date(event.timestamp),
        completed_tasks_count: event.data?.completedTasks?.length || 0,
        pending_tasks_count: event.data?.pendingTasks?.length || 0
    }, { transaction });

    console.log(`   ✅ Sesión ${event.pair_session_id} finalizada`);
}

/**
 * Procesa CHAT_INTERACTION
 */
async function processChatInteraction(event, transaction) {
    const data = event.data || {};

    // Validar que tenga los campos mínimos
    if (!data.message_content || !data.message_type) {
        console.log(`   ⚠️  CHAT_INTERACTION sin contenido, omitiendo...`);
        return;
    }

    // Generar conversation_id si no existe
    const conversationId = data.conversation_id || 
                          event.conversation_id || 
                          `${event.pair_session_id}_conv_${Date.now()}`;

    const chatMessage = {
        message_id: data.message_id || event.event_id,
        conversation_id: conversationId,
        pair_session_id: event.pair_session_id || null,
        message_order: data.message_order || 0,
        parent_message_id: data.parent_message_id || null,
        author_user_id: getUserId(data.author_email || event.active_user_email),
        author_role: data.author_role || null,
        driver_user_id: getUserId(data.driver_email || event.driver_email),
        navigator_user_id: getUserId(data.navigator_email || event.navigator_email),
        message_type: data.message_type,
        message_content: data.message_content,
        message_length: data.message_length || data.message_content.length,
        included_code: data.included_code || false,
        code_language: data.code_language || null,
        code_lines_count: data.code_lines_count || null,
        query_category: data.query_category || null,
        response_time_ms: data.response_time_ms || null,
        timestamp: new Date(event.timestamp),
        created_at: new Date()
    };

    await db.ChatMessage.create(chatMessage, { transaction });
    console.log(`   ✅ Mensaje de chat guardado: ${data.message_type}`);
}

/**
 * Procesa CODE_SNAPSHOT
 */
async function processCodeSnapshot(event, transaction) {
    const data = event.data || {};
    const metadata = data.metadata || {};

    if (!data.code_content) {
        console.log(`   ⚠️  CODE_SNAPSHOT sin código, omitiendo...`);
        return;
    }

    // Truncar código si es muy grande (más de 100KB)
    let codeContent = data.code_content;
    let truncated = false;
    if (codeContent.length > 100000) {
        codeContent = codeContent.substring(0, 100000);
        truncated = true;
        console.log(`   ⚠️  Código truncado (era muy grande)`);
    }

    const snapshot = {
        user_id: getUserId(event.active_user_email),
        session_id: event.session_id || null,
        pair_session_id: event.pair_session_id || null,
        author_user_id: getUserId(event.active_user_email),
        author_role: null, // Se podría obtener de pairSession
        driver_user_id: getUserId(event.driver_email),
        navigator_user_id: getUserId(event.navigator_email),
        file_name: metadata.file_name || 'unknown',
        language: metadata.language || null,
        file_path: metadata.file_path || null,
        code_content: codeContent,
        line_count: metadata.metrics?.line_count || null,
        char_count: metadata.metrics?.char_count || null,
        workspace_info: metadata.workspace || null,
        workspace_name: metadata.workspace?.name || null,
        timestamp: new Date(event.timestamp),
        snapshot_id_uuid: event.event_id
    };

    // TODO: Calcular lines_added y chars_added comparando con snapshot anterior
    // Esto requiere una query adicional, lo dejamos para optimización futura

    await db.CodeSnapshot.create(snapshot, { transaction });
    console.log(`   ✅ Code snapshot guardado: ${metadata.file_name}`);
}

/**
 * Procesa TASK_CREATE
 */
async function processTaskCreate(event, transaction) {
    const data = event.data || {};

    if (!data.description) {
        console.log(`   ⚠️  TASK_CREATE sin descripción, omitiendo...`);
        return;
    }

    // Buscar la sesión de pair programming
    let ppSessionId = null;
    if (event.pair_session_id) {
        const session = await db.PairProgrammingSession.findOne({
            where: { pair_session_id: event.pair_session_id },
            attributes: ['pp_session_id'],
            transaction
        });
        ppSessionId = session?.pp_session_id || null;
    }

    const task = {
        pp_session_id: ppSessionId,
        description: data.description,
        created_at: new Date(event.timestamp)
    };

    await db.PPTask.create(task, { transaction });
    console.log(`   ✅ Tarea creada: "${data.description.substring(0, 50)}..."`);
}

/**
 * Procesa TASK_COMPLETE
 */
async function processTaskComplete(event, transaction) {
    const data = event.data || {};

    if (!data.task_id) {
        console.log(`   ⚠️  TASK_COMPLETE sin task_id, omitiendo...`);
        return;
    }

    // Buscar la tarea
    const task = await db.PPTask.findOne({
        where: { task_id: data.task_id },
        transaction
    });

    if (!task) {
        console.log(`   ⚠️  Tarea ${data.task_id} no encontrada`);
        return;
    }

    await task.update({
        completed_at: new Date(event.timestamp),
        completed_by_user_id: getUserId(event.active_user_email)
    }, { transaction });

    console.log(`   ✅ Tarea completada: ${data.task_id}`);
}

/**
 * Procesa CODE_ANALYSIS_RESULT
 */
async function processCodeAnalysis(event, transaction) {
    const data = event.data || {};

    if (!data.language) {
        console.log(`   ⚠️  CODE_ANALYSIS sin lenguaje, omitiendo...`);
        return;
    }

    const analysis = {
        session_id: event.session_id || null,
        user_id: getUserId(event.active_user_email),
        code_snippet: null, // No guardamos el código completo aquí
        language: data.language,
        character_count: data.metrics?.char_count || null,
        line_count: data.metrics?.line_count || null,
        contains_errors: (data.issues_count || 0) > 0,
        complexity_score: data.metrics?.complexity_score || null,
        analyzed_at: new Date(event.timestamp)
    };

    await db.CodeAnalysis.create(analysis, { transaction });
    console.log(`   ✅ Análisis de código guardado: ${data.language}`);
}

/**
 * Endpoint para exportar analytics (para administradores)
 * GET /api/analytics/export
 */
const exportAnalytics = async (req, res) => {
    try {
        // TODO: Agregar autenticación de administrador aquí
        
        const events = await db.AnalyticsEvent.findAll({
            limit: 1000,
            order: [['timestamp', 'DESC']]
        });

        return res.status(200).json({
            total: events.length,
            events
        });
    } catch (error) {
        console.error('Error al exportar analytics:', error);
        return res.status(500).json({ error: 'Error del servidor' });
    }
};

module.exports = {
    receiveEvents,
    exportAnalytics
};
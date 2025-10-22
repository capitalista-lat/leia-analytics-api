/**
 * Controlador para manejar eventos de analytics
 */

const db = require('../models');
const { Op } = require('sequelize');

/**
 * Recibe y procesa eventos de analytics desde la extensión
 */
exports.receiveEvents = async (req, res) => {
    const transaction = await db.sequelize.transaction();
    
    try {
        const { events } = req.body;

        // Validar que se recibió un array de eventos
        if (!events || !Array.isArray(events)) {
            return res.status(400).json({ error: 'Se requiere un array de eventos' });
        }

        console.log(`📊 Recibiendo ${events.length} eventos de analytics...`);

        const results = {
            processed: 0,
            errors: 0,
            errorDetails: []
        };

        // Procesar cada evento
        for (const event of events) {
            try {
                await processEvent(event, transaction);
                results.processed++;
            } catch (error) {
                console.error(`❌ Error procesando evento ${event.event_id}:`, error);
                results.errors++;
                results.errorDetails.push({
                    event_id: event.event_id,
                    error: error.message
                });
            }
        }

        await transaction.commit();

        console.log(`✅ Procesados: ${results.processed}, ❌ Errores: ${results.errors}`);

        res.status(200).json({
            message: 'Eventos procesados',
            results
        });

    } catch (error) {
        await transaction.rollback();
        console.error('❌ Error general al procesar eventos:', error);
        res.status(500).json({ 
            error: 'Error al procesar eventos',
            details: error.message 
        });
    }
};

/**
 * Procesa un evento individual según su tipo
 */
async function processEvent(eventData, transaction) {
    const eventType = eventData.event_type;

    // Obtener o crear el usuario
    const user = await getOrCreateUser(eventData, transaction);

    // Obtener o crear la sesión
    const session = await getOrCreateSession(eventData, user, transaction);

    // Procesar según el tipo de evento
    switch (eventType) {
        case 'SESSION_START':
            await processSessionStart(eventData, user, session, transaction);
            break;

        case 'SESSION_END':
            await processSessionEnd(eventData, user, session, transaction);
            break;

        case 'USER_LOGIN':
            await processUserLogin(eventData, user, session, transaction);
            break;

        case 'USER_LOGOUT':
            await processUserLogout(eventData, user, session, transaction);
            break;

        case 'CHAT_INTERACTION':
            await processChatInteraction(eventData, session, transaction);
            break;

        case 'PAIR_SESSION_START':
            await processPairSessionStart(eventData, session, transaction);
            break;

        case 'PAIR_SESSION_END':
            await processPairSessionEnd(eventData, session, transaction);
            break;

        case 'PAIR_ROLE_SWITCH':
            await processPairRoleSwitch(eventData, session, transaction);
            break;

        case 'TASK_CREATE':
            await processTaskCreate(eventData, session, transaction);
            break;

        case 'TASK_COMPLETE':
            await processTaskComplete(eventData, session, transaction);
            break;

        case 'CODE_ANALYSIS':
        case 'CODE_ANALYSIS_RESULT':
            await processCodeAnalysis(eventData, user, session, transaction);
            break;

        case 'CODE_SNAPSHOT':
            await processCodeSnapshot(eventData, user, session, transaction);
            break;

        case 'API_RESPONSE_TIME':
            await processApiResponseTime(eventData, user, session, transaction);
            break;

        default:
            // Para eventos no específicamente manejados, guardar en analytics_events
            await saveGenericEvent(eventData, user, session, transaction);
    }

    console.log(`✓ Evento procesado: ${eventType} por ${eventData.active_user_email || 'unknown'}`);
}

/**
 * Obtiene o crea un usuario
 */
async function getOrCreateUser(eventData, transaction) {
    const userEmail = eventData.active_user_email;
    
    if (!userEmail) {
        throw new Error('No se encontró active_user_email en el evento');
    }

    const [user, created] = await db.User.findOrCreate({
        where: { email: userEmail },
        defaults: { 
            email: userEmail,
            university_domain: userEmail.split('@')[1]
        },
        transaction
    });

    if (created) {
        console.log(`👤 Nuevo usuario creado: ${user.email}`);
    }

    // Actualizar last_active_at
    await user.update({
        last_active_at: eventData.timestamp
    }, { transaction });

    return user;
}

/**
 * Obtiene o crea una sesión
 */
async function getOrCreateSession(eventData, user, transaction) {
    const sessionId = eventData.session_id;
    
    if (!sessionId) {
        throw new Error('No se encontró session_id en el evento');
    }

    const [session, created] = await db.Session.findOrCreate({
        where: { session_id: sessionId },
        defaults: {
            session_id: sessionId,
            user_id: user.user_id,
            start_time: eventData.timestamp,
            device_id: eventData.device_id,
            platform_info: eventData.platform_info
        },
        transaction
    });

    if (created) {
        console.log(`🔌 Nueva sesión creada: ${session.session_id}`);
    }

    return session;
}

/**
 * Procesa evento SESSION_START
 */
async function processSessionStart(eventData, user, session, transaction) {
    await db.AnalyticsEvent.create({
        event_id: eventData.event_id,
        event_type: eventData.event_type,
        user_id: user.user_id,
        session_id: session.session_id,
        timestamp: eventData.timestamp,
        data: eventData.data || {}
    }, { transaction });
}

/**
 * Procesa evento SESSION_END
 */
async function processSessionEnd(eventData, user, session, transaction) {
    await session.update({
        end_time: eventData.timestamp
    }, { transaction });

    await db.AnalyticsEvent.create({
        event_id: eventData.event_id,
        event_type: eventData.event_type,
        user_id: user.user_id,
        session_id: session.session_id,
        timestamp: eventData.timestamp,
        data: eventData.data || {}
    }, { transaction });
}

/**
 * Procesa evento USER_LOGIN
 */
async function processUserLogin(eventData, user, session, transaction) {
    await db.AnalyticsEvent.create({
        event_id: eventData.event_id,
        event_type: eventData.event_type,
        user_id: user.user_id,
        session_id: session.session_id,
        timestamp: eventData.timestamp,
        data: {
            ...eventData.data,
            domain: eventData.data?.domain || user.email.split('@')[1],
            role: eventData.data?.role
        }
    }, { transaction });
}

/**
 * Procesa evento USER_LOGOUT
 */
async function processUserLogout(eventData, user, session, transaction) {
    await db.AnalyticsEvent.create({
        event_id: eventData.event_id,
        event_type: eventData.event_type,
        user_id: user.user_id,
        session_id: session.session_id,
        timestamp: eventData.timestamp,
        data: eventData.data || {}
    }, { transaction });
}

/**
 * Procesa eventos de interacción de chat
 */
async function processChatInteraction(eventData, session, transaction) {
    try {
        console.log('💬 Procesando interacción de chat...');

        // 1. OBTENER O CREAR EL USUARIO ACTIVO (quien envía el mensaje)
        const activeUserEmail = eventData.active_user_email;
        if (!activeUserEmail) {
            throw new Error('No se encontró active_user_email en el evento de chat');
        }

        const [activeUser] = await db.User.findOrCreate({
            where: { email: activeUserEmail },
            defaults: { 
                email: activeUserEmail,
                university_domain: activeUserEmail.split('@')[1]
            },
            transaction
        });

        console.log(`👤 Usuario activo: ${activeUser.email} (ID: ${activeUser.user_id})`);

        // 2. OBTENER O CREAR DRIVER Y NAVIGATOR (si están en pair programming)
        let driverUser = null;
        let navigatorUser = null;

        if (eventData.driver_email) {
            [driverUser] = await db.User.findOrCreate({
                where: { email: eventData.driver_email },
                defaults: { 
                    email: eventData.driver_email,
                    university_domain: eventData.driver_email.split('@')[1]
                },
                transaction
            });
            console.log(`🎯 Driver: ${driverUser.email} (ID: ${driverUser.user_id})`);
        }

        if (eventData.navigator_email) {
            [navigatorUser] = await db.User.findOrCreate({
                where: { email: eventData.navigator_email },
                defaults: { 
                    email: eventData.navigator_email,
                    university_domain: eventData.navigator_email.split('@')[1]
                },
                transaction
            });
            console.log(`🧭 Navigator: ${navigatorUser.email} (ID: ${navigatorUser.user_id})`);
        }

        if (!driverUser && !navigatorUser) {
            console.log('ℹ️  No hay sesión de pair programming activa para este mensaje');
        }

        // 3. GUARDAR EL EVENTO EN analytics_events
        const conversationId = eventData.data?.conversation_id;
        const pairSessionId = eventData.pair_session_id;

        const analyticsEvent = await db.AnalyticsEvent.create({
            event_id: eventData.event_id,
            event_type: eventData.event_type,
            user_id: activeUser.user_id,
            session_id: session.session_id,
            timestamp: eventData.timestamp,
            conversation_id: conversationId,
            pair_session_id: pairSessionId,
            driver_user_id: driverUser?.user_id || null,
            navigator_user_id: navigatorUser?.user_id || null,
            data: {
                // IDs
                message_id: eventData.data?.message_id,
                message_order: eventData.data?.message_order,
                parent_message_id: eventData.data?.parent_message_id,
                
                // Contenido del mensaje
                message_type: eventData.data?.message_type,
                message_content: eventData.data?.message_content,
                message_length: eventData.data?.message_length,
                
                // Información de código
                included_code: eventData.data?.included_code || false,
                code_language: eventData.data?.code_language,
                code_lines_count: eventData.data?.code_lines_count,
                
                // Usuarios involucrados
                author_email: activeUserEmail,
                author_role: eventData.data?.author_role,
                
                // Timing
                response_time_ms: eventData.data?.response_time_ms,
                
                // Contexto
                in_pair_session: eventData.data?.in_pair_session || false,
                
                // Clasificación
                query_category: eventData.data?.query_category,
                
                // Device info
                device_id: eventData.device_id,
                
                // Platform info
                platform_info: eventData.platform_info
            }
        }, { transaction });

        console.log(`✅ Evento de chat guardado: ${analyticsEvent.event_id}`);

        // 4. GUARDAR EL MENSAJE EN LA TABLA chat_messages
        if (db.ChatMessage && conversationId) {
            try {
                const messageId = eventData.data?.message_id;
                
                // Verificar si el mensaje ya existe
                const existingMessage = messageId ? await db.ChatMessage.findByPk(messageId, { transaction }) : null;
                
                if (!existingMessage) {
                    const chatMessage = await db.ChatMessage.create({
                        message_id: messageId || eventData.event_id,
                        conversation_id: conversationId,
                        pair_session_id: pairSessionId,
                        message_order: eventData.data?.message_order || 0,
                        parent_message_id: eventData.data?.parent_message_id || null,
                        author_user_id: activeUser.user_id,
                        author_role: eventData.data?.author_role,
                        driver_user_id: driverUser?.user_id || null,
                        navigator_user_id: navigatorUser?.user_id || null,
                        message_type: eventData.data?.message_type,
                        message_content: eventData.data?.message_content,
                        message_length: eventData.data?.message_length,
                        included_code: eventData.data?.included_code || false,
                        code_language: eventData.data?.code_language,
                        code_lines_count: eventData.data?.code_lines_count,
                        query_category: eventData.data?.query_category,
                        response_time_ms: eventData.data?.response_time_ms,
                        timestamp: eventData.timestamp
                    }, { transaction });

                    console.log(`✅ Mensaje guardado en chat_messages: ${chatMessage.message_id}`);
                } else {
                    console.log(`ℹ️  Mensaje ${messageId} ya existe, omitiendo...`);
                }
            } catch (chatMsgError) {
                console.error('⚠️  Error al guardar en chat_messages:', chatMsgError.message);
                // No lanzar error, continuar
            }
        }

        // 5. GUARDAR TAMBIÉN EN chat_interactions (tabla legacy)
        if (db.ChatInteraction) {
            try {
                await db.ChatInteraction.create({
                    session_id: session.session_id,
                    user_id: activeUser.user_id,
                    message_type: eventData.data?.message_type,
                    message_content: eventData.data?.message_content,
                    timestamp: eventData.timestamp,
                    included_code: eventData.data?.included_code || false,
                    code_language: eventData.data?.code_language,
                    query_category: eventData.data?.query_category,
                    conversation_id: conversationId,
                    pair_session_id: pairSessionId,
                    message_id: eventData.data?.message_id,
                    author_role: eventData.data?.author_role
                }, { transaction });

                console.log(`✅ Guardado también en chat_interactions (legacy)`);
            } catch (legacyError) {
                console.log('⚠️  No se pudo guardar en chat_interactions:', legacyError.message);
            }
        }

        return analyticsEvent;

    } catch (error) {
        console.error('❌ Error al procesar interacción de chat:', error);
        throw error;
    }
}

/**
 * Procesa evento PAIR_SESSION_START
 */
async function processPairSessionStart(eventData, session, transaction) {
    const driverEmail = eventData.driver_email;
    const navigatorEmail = eventData.navigator_email;

    if (!driverEmail || !navigatorEmail) {
        throw new Error('Se requieren driver_email y navigator_email para iniciar sesión de pair programming');
    }

    // Crear usuarios si no existen
    const [driverUser] = await db.User.findOrCreate({
        where: { email: driverEmail },
        defaults: { 
            email: driverEmail,
            university_domain: driverEmail.split('@')[1]
        },
        transaction
    });

    const [navigatorUser] = await db.User.findOrCreate({
        where: { email: navigatorEmail },
        defaults: { 
            email: navigatorEmail,
            university_domain: navigatorEmail.split('@')[1]
        },
        transaction
    });

    // Crear sesión de pair programming
    const pairSessionId = eventData.pair_session_id || eventData.data?.pair_session_id;
    
    if (pairSessionId && db.PairProgrammingSession) {
        try {
            await db.PairProgrammingSession.create({
                pair_session_id: pairSessionId,
                session_id: session.session_id,
                driver_id: driverUser.user_id,
                navigator_id: navigatorUser.user_id,
                current_driver_id: driverUser.user_id,
                start_time: eventData.timestamp,
                expected_duration_minutes: eventData.data?.expected_duration_minutes || 15,
                workspace_name: eventData.data?.workspace_name || eventData.platform_info?.workspace_name
            }, { transaction });
            
            console.log(`✅ Sesión PP creada: ${pairSessionId}`);
        } catch (pairError) {
            console.error('⚠️  Error al crear PairProgrammingSession:', pairError.message);
        }
    }

    // Guardar evento
    await db.AnalyticsEvent.create({
        event_id: eventData.event_id,
        event_type: eventData.event_type,
        user_id: driverUser.user_id,
        session_id: session.session_id,
        timestamp: eventData.timestamp,
        pair_session_id: pairSessionId,
        driver_user_id: driverUser.user_id,
        navigator_user_id: navigatorUser.user_id,
        data: {
            ...eventData.data,
            pair_session_id: pairSessionId,
            driver_email: driverEmail,
            navigator_email: navigatorEmail
        }
    }, { transaction });
}

/**
 * Procesa evento PAIR_SESSION_END
 */
async function processPairSessionEnd(eventData, session, transaction) {
    const pairSessionId = eventData.pair_session_id || eventData.data?.pair_session_id;

    if (pairSessionId && db.PairProgrammingSession) {
        try {
            const pairSession = await db.PairProgrammingSession.findOne({
                where: { pair_session_id: pairSessionId },
                transaction
            });

            if (pairSession) {
                await pairSession.update({
                    end_time: eventData.timestamp,
                    completed_tasks_count: eventData.data?.completed_tasks?.length || 0,
                    pending_tasks_count: eventData.data?.pending_tasks?.length || 0
                }, { transaction });
            }
        } catch (pairError) {
            console.error('⚠️  Error al actualizar PairProgrammingSession:', pairError.message);
        }
    }

    const [user] = await db.User.findOrCreate({
        where: { email: eventData.active_user_email },
        defaults: { 
            email: eventData.active_user_email,
            university_domain: eventData.active_user_email.split('@')[1]
        },
        transaction
    });

    await db.AnalyticsEvent.create({
        event_id: eventData.event_id,
        event_type: eventData.event_type,
        user_id: user.user_id,
        session_id: session.session_id,
        timestamp: eventData.timestamp,
        pair_session_id: pairSessionId,
        data: {
            ...eventData.data,
            pair_session_id: pairSessionId
        }
    }, { transaction });
}

/**
 * Procesa evento PAIR_ROLE_SWITCH
 */
async function processPairRoleSwitch(eventData, session, transaction) {
    const pairSessionId = eventData.pair_session_id;
    
    // Obtener usuarios
    const [user] = await db.User.findOrCreate({
        where: { email: eventData.active_user_email },
        defaults: { 
            email: eventData.active_user_email,
            university_domain: eventData.active_user_email.split('@')[1]
        },
        transaction
    });

    let newDriverUser = null;
    if (eventData.driver_email) {
        [newDriverUser] = await db.User.findOrCreate({
            where: { email: eventData.driver_email },
            defaults: { 
                email: eventData.driver_email,
                university_domain: eventData.driver_email.split('@')[1]
            },
            transaction
        });
    }

    // Actualizar current_driver_id en pair_programming_sessions
    if (pairSessionId && newDriverUser && db.PairProgrammingSession) {
        try {
            const pairSession = await db.PairProgrammingSession.findOne({
                where: { pair_session_id: pairSessionId },
                transaction
            });

            if (pairSession) {
                await pairSession.update({
                    current_driver_id: newDriverUser.user_id,
                    total_role_switches: (pairSession.total_role_switches || 0) + 1
                }, { transaction });

                // Registrar en role_switches
                if (db.RoleSwitch) {
                    await db.RoleSwitch.create({
                        pp_session_id: pairSession.pp_session_id,
                        timestamp: eventData.timestamp,
                        previous_driver: pairSession.current_driver_id,
                        new_driver: newDriverUser.user_id
                    }, { transaction });
                }
            }
        } catch (switchError) {
            console.error('⚠️  Error al registrar cambio de rol:', switchError.message);
        }
    }

    await db.AnalyticsEvent.create({
        event_id: eventData.event_id,
        event_type: eventData.event_type,
        user_id: user.user_id,
        session_id: session.session_id,
        timestamp: eventData.timestamp,
        pair_session_id: pairSessionId,
        driver_user_id: newDriverUser?.user_id,
        data: {
            ...eventData.data,
            previous_driver: eventData.data?.previous_driver,
            previous_navigator: eventData.data?.previous_navigator,
            new_driver: eventData.driver_email,
            new_navigator: eventData.navigator_email
        }
    }, { transaction });
}

/**
 * Procesa evento TASK_CREATE
 */
async function processTaskCreate(eventData, session, transaction) {
    const [user] = await db.User.findOrCreate({
        where: { email: eventData.active_user_email },
        defaults: { 
            email: eventData.active_user_email,
            university_domain: eventData.active_user_email.split('@')[1]
        },
        transaction
    });

    await db.AnalyticsEvent.create({
        event_id: eventData.event_id,
        event_type: eventData.event_type,
        user_id: user.user_id,
        session_id: session.session_id,
        timestamp: eventData.timestamp,
        pair_session_id: eventData.pair_session_id,
        data: eventData.data || {}
    }, { transaction });
}

/**
 * Procesa evento TASK_COMPLETE
 */
async function processTaskComplete(eventData, session, transaction) {
    const [user] = await db.User.findOrCreate({
        where: { email: eventData.active_user_email },
        defaults: { 
            email: eventData.active_user_email,
            university_domain: eventData.active_user_email.split('@')[1]
        },
        transaction
    });

    await db.AnalyticsEvent.create({
        event_id: eventData.event_id,
        event_type: eventData.event_type,
        user_id: user.user_id,
        session_id: session.session_id,
        timestamp: eventData.timestamp,
        pair_session_id: eventData.pair_session_id,
        data: eventData.data || {}
    }, { transaction });
}

/**
 * Procesa eventos de análisis de código
 */
async function processCodeAnalysis(eventData, user, session, transaction) {
    await db.AnalyticsEvent.create({
        event_id: eventData.event_id,
        event_type: eventData.event_type,
        user_id: user.user_id,
        session_id: session.session_id,
        timestamp: eventData.timestamp,
        pair_session_id: eventData.pair_session_id,
        data: {
            ...eventData.data,
            current_role: eventData.data?.current_role
        }
    }, { transaction });
}

/**
 * Procesa eventos de instantáneas de código
 */
async function processCodeSnapshot(eventData, user, session, transaction) {
    try {
        const metadata = eventData.data?.metadata || {};
        const codeContent = eventData.data?.code_content;

        // Obtener driver y navigator si están presentes
        let driverUser = null;
        let navigatorUser = null;

        if (eventData.driver_email) {
            [driverUser] = await db.User.findOrCreate({
                where: { email: eventData.driver_email },
                defaults: { 
                    email: eventData.driver_email,
                    university_domain: eventData.driver_email.split('@')[1]
                },
                transaction
            });
        }

        if (eventData.navigator_email) {
            [navigatorUser] = await db.User.findOrCreate({
                where: { email: eventData.navigator_email },
                defaults: { 
                    email: eventData.navigator_email,
                    university_domain: eventData.navigator_email.split('@')[1]
                },
                transaction
            });
        }

        // Guardar en code_snapshots
        if (db.CodeSnapshot && codeContent) {
            try {
                await db.CodeSnapshot.create({
                    user_id: user.user_id,
                    session_id: session.session_id,
                    pair_session_id: eventData.pair_session_id,
                    author_user_id: user.user_id,
                    author_role: metadata.pair_session?.navigator === user.email ? 'navigator' : 'driver',
                    driver_user_id: driverUser?.user_id,
                    navigator_user_id: navigatorUser?.user_id,
                    file_name: metadata.file_name,
                    language: metadata.language,
                    file_path: metadata.file_path,
                    code_content: codeContent,
                    line_count: metadata.metrics?.line_count,
                    char_count: metadata.metrics?.char_count,
                    workspace_info: metadata.workspace,
                    workspace_name: metadata.workspace?.name,
                    pair_session_info: metadata.pair_session,
                    timestamp: eventData.timestamp
                }, { transaction });

                console.log(`✅ Code snapshot guardado`);
            } catch (snapshotError) {
                console.error('⚠️  Error al guardar code snapshot:', snapshotError.message);
            }
        }

        // Guardar evento
        await db.AnalyticsEvent.create({
            event_id: eventData.event_id,
            event_type: eventData.event_type,
            user_id: user.user_id,
            session_id: session.session_id,
            timestamp: eventData.timestamp,
            pair_session_id: eventData.pair_session_id,
            driver_user_id: driverUser?.user_id,
            navigator_user_id: navigatorUser?.user_id,
            data: {
                metadata: metadata,
                file_name: metadata.file_name,
                language: metadata.language,
                line_count: metadata.metrics?.line_count,
                has_code_content: !!codeContent
            }
        }, { transaction });

    } catch (error) {
        console.error('❌ Error en processCodeSnapshot:', error);
        throw error;
    }
}

/**
 * Procesa eventos de tiempo de respuesta de API
 */
async function processApiResponseTime(eventData, user, session, transaction) {
    await db.AnalyticsEvent.create({
        event_id: eventData.event_id,
        event_type: eventData.event_type,
        user_id: user.user_id,
        session_id: session.session_id,
        timestamp: eventData.timestamp,
        pair_session_id: eventData.pair_session_id,
        data: {
            ...eventData.data
        }
    }, { transaction });
}

/**
 * Guarda un evento genérico en analytics_events
 */
async function saveGenericEvent(eventData, user, session, transaction) {
    await db.AnalyticsEvent.create({
        event_id: eventData.event_id,
        event_type: eventData.event_type,
        user_id: user.user_id,
        session_id: session.session_id,
        timestamp: eventData.timestamp,
        pair_session_id: eventData.pair_session_id,
        data: eventData.data || {}
    }, { transaction });
}

/**
 * Exporta datos de analytics (para administradores)
 */
exports.exportAnalytics = async (req, res) => {
    try {
        const events = await db.AnalyticsEvent.findAll({
            include: [
                { model: db.User, as: 'user' },
                { model: db.Session, as: 'session' }
            ],
            order: [['timestamp', 'DESC']],
            limit: 1000
        });

        res.json({
            total: events.length,
            events: events
        });

    } catch (error) {
        console.error('Error al exportar analytics:', error);
        res.status(500).json({ error: 'Error al exportar datos' });
    }
};

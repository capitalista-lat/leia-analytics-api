/**
 * BACKEND ACTUALIZADO - analyticsController.js
 * 
 * Cambios para soportar 2 usuarios en 1 dispositivo con pair programming
 */

const db = require('../models');
const { Op } = require('sequelize');

/**
 * Recibir eventos de analytics desde la extensión de VS Code
 */
exports.receiveEvents = async (req, res) => {
  try {
    const { events } = req.body;

    if (!events || !Array.isArray(events)) {
      return res.status(400).json({ 
        error: 'Se requiere un array de eventos' 
      });
    }

    console.log(`📊 Recibiendo ${events.length} eventos de analytics...`);

    let processedCount = 0;
    let errorCount = 0;

    // Procesar cada evento
    for (const event of events) {
      try {
        await processEvent(event);
        processedCount++;
      } catch (error) {
        console.error(`❌ Error procesando evento ${event.event_id}:`, error);
        errorCount++;
      }
    }

    console.log(`✅ Procesados: ${processedCount}, ❌ Errores: ${errorCount}`);

    return res.status(200).json({
      success: true,
      message: `${processedCount} eventos procesados correctamente`,
      processed: processedCount,
      errors: errorCount
    });

  } catch (error) {
    console.error('❌ Error general al recibir eventos:', error);
    return res.status(500).json({ 
      error: 'Error del servidor al procesar eventos' 
    });
  }
};

/**
 * ⭐ FUNCIÓN PRINCIPAL MODIFICADA
 * Procesa un evento individual
 */
async function processEvent(event) {
  const { 
    event_id, 
    event_type, 
    timestamp,
    session_id,
    pair_session_id,
    conversation_id,
    device_id,
    active_user_email,  // ⭐ NUEVO: Quién hizo la acción
    driver_email,       // ⭐ NUEVO: Quién es el driver
    navigator_email,    // ⭐ NUEVO: Quién es el navigator
    platform_info,
    data
  } = event;

  // ⭐ BUSCAR O CREAR LOS USUARIOS INVOLUCRADOS
  let activeUser = null;
  let driverUser = null;
  let navigatorUser = null;

  // Usuario activo (quien hizo la acción)
  if (active_user_email) {
    activeUser = await findOrCreateUser(active_user_email);
  }

  // En pair programming, trackear ambos usuarios
  if (driver_email) {
    driverUser = await findOrCreateUser(driver_email);
  }
  if (navigator_email) {
    navigatorUser = await findOrCreateUser(navigator_email);
  }

  // Actualizar last_active_at del usuario activo
  if (activeUser) {
    await activeUser.update({ last_active_at: new Date(timestamp) });
  }

  // ⭐ BUSCAR O CREAR SESIÓN
  let session = null;
  if (session_id) {
    session = await findOrCreateSession(
      session_id, 
      activeUser, 
      device_id, 
      platform_info
    );
  }

  // ⭐ CREAR EVENTO EN LA BASE DE DATOS
  await db.AnalyticsEvent.create({
    event_id: event_id,
    event_type: event_type,
    timestamp: new Date(timestamp),
    session_id: session_id,
    pair_session_id: pair_session_id,
    conversation_id: conversation_id,
    
    // ⭐ IDs de usuarios (pueden ser null si no aplican)
    user_id: activeUser ? activeUser.user_id : null,
    driver_user_id: driverUser ? driverUser.user_id : null,
    navigator_user_id: navigatorUser ? navigatorUser.user_id : null,
    
    device_id: device_id,
    platform_info: platform_info,
    event_data: data // JSON field
  });

  // ⭐ PROCESAR EVENTOS ESPECÍFICOS
  if (event_type.startsWith('PAIR_')) {
    await processPairProgrammingEvent(
      event, 
      activeUser, 
      driverUser, 
      navigatorUser, 
      session
    );
  }

  if (event_type.startsWith('TASK_')) {
    await processTaskEvent(event, activeUser, session_id, pair_session_id);
  }

  if (event_type === 'CODE_SNAPSHOT') {
    await processCodeSnapshot(
      event, 
      activeUser, 
      driverUser, 
      navigatorUser
    );
  }

  if (event_type === 'CHAT_INTERACTION') {
    await processChatInteraction(
      event, 
      activeUser, 
      driverUser, 
      navigatorUser
    );
  }

  console.log(`✓ Evento procesado: ${event_type} por ${active_user_email || 'unknown'}`);
}

/**
 * ⭐ NUEVA FUNCIÓN: Buscar o crear usuario
 */
async function findOrCreateUser(email) {
  if (!email) return null;

  const [user, created] = await db.User.findOrCreate({
    where: { email: email },
    defaults: {
      university_domain: email.split('@')[1],
      created_at: new Date(),
      last_active_at: new Date()
    }
  });

  if (created) {
    console.log(`👤 Nuevo usuario creado: ${email}`);
  }

  return user;
}

/**
 * ⭐ FUNCIÓN MODIFICADA: Buscar o crear sesión
 */
async function findOrCreateSession(session_id, user, device_id, platform_info) {
  if (!session_id) return null;

  const [session, created] = await db.Session.findOrCreate({
    where: { session_id: session_id },
    defaults: {
      user_id: user ? user.user_id : null,
      device_id: device_id,
      start_time: new Date(),
      platform_info: platform_info
    }
  });

  if (created) {
    console.log(`🔌 Nueva sesión creada: ${session_id}`);
  }

  return session;
}

/**
 * ⭐ FUNCIÓN MODIFICADA: Procesar eventos de Pair Programming
 */
async function processPairProgrammingEvent(event, activeUser, driverUser, navigatorUser, session) {
  const { event_type, data, pair_session_id } = event;

  switch (event_type) {
    case 'PAIR_SESSION_START':
      await handlePairSessionStart(
        pair_session_id, 
        driverUser, 
        navigatorUser, 
        data
      );
      break;

    case 'PAIR_ROLE_SWITCH':
      await handlePairRoleSwitch(
        pair_session_id, 
        driverUser, 
        navigatorUser, 
        data
      );
      break;

    case 'PAIR_SESSION_END':
      await handlePairSessionEnd(pair_session_id, data);
      break;

    default:
      console.log(`⚠️ Evento de pair programming no manejado: ${event_type}`);
  }
}

/**
 * ⭐ FUNCIÓN MODIFICADA: Manejar inicio de sesión de pair programming
 */
async function handlePairSessionStart(pair_session_id, driverUser, navigatorUser, data) {
  try {
    if (!driverUser || !navigatorUser) {
      console.error('❌ No se pudieron obtener driver y navigator');
      return;
    }

    // Crear la sesión de pair programming
    await db.PairProgrammingSession.create({
      pair_session_id: pair_session_id,
      driver_id: driverUser.user_id,
      navigator_id: navigatorUser.user_id,
      current_driver_id: driverUser.user_id, // ⭐ NUEVO: Trackear quien es el driver actual
      start_time: new Date(data.start_time || new Date()),
      expected_duration_minutes: data.expected_duration_minutes || 15,
      workspace_name: data.workspace_name,
      total_role_switches: 0,
      completed_tasks_count: 0,
      pending_tasks_count: 0
    });

    console.log(`✅ Sesión PP iniciada: ${pair_session_id}`);
    console.log(`   Driver: ${driverUser.email}`);
    console.log(`   Navigator: ${navigatorUser.email}`);

  } catch (error) {
    console.error('❌ Error al crear sesión de pair programming:', error);
    throw error;
  }
}

/**
 * ⭐ FUNCIÓN MODIFICADA: Manejar cambio de roles
 */
async function handlePairRoleSwitch(pair_session_id, newDriverUser, newNavigatorUser, data) {
  try {
    // Buscar la sesión de pair programming activa
    const ppSession = await db.PairProgrammingSession.findOne({
      where: { 
        pair_session_id: pair_session_id,
        end_time: null // Solo sesiones activas
      }
    });

    if (!ppSession) {
      console.error('❌ No se encontró sesión activa para cambio de roles');
      return;
    }

    // Incrementar contador de cambios de rol
    ppSession.total_role_switches += 1;
    
    // ⭐ ACTUALIZAR quien es el driver actual
    if (newDriverUser) {
      ppSession.current_driver_id = newDriverUser.user_id;
    }
    
    await ppSession.save();

    console.log(`🔄 Cambio de roles #${ppSession.total_role_switches}`);
    console.log(`   Nuevo driver: ${newDriverUser?.email}`);
    console.log(`   Nuevo navigator: ${newNavigatorUser?.email}`);

  } catch (error) {
    console.error('❌ Error al registrar cambio de roles:', error);
    throw error;
  }
}

/**
 * Manejar fin de sesión de pair programming
 */
async function handlePairSessionEnd(pair_session_id, data) {
  try {
    const ppSession = await db.PairProgrammingSession.findOne({
      where: { 
        pair_session_id: pair_session_id,
        end_time: null
      }
    });

    if (!ppSession) {
      console.error('❌ No se encontró sesión activa para finalizar');
      return;
    }

    // Actualizar la sesión con datos de finalización
    ppSession.end_time = new Date(data.end_time || new Date());
    ppSession.completed_tasks_count = data.completed_tasks || 0;
    ppSession.pending_tasks_count = data.pending_tasks || 0;

    await ppSession.save();

    const duration = (ppSession.end_time - ppSession.start_time) / 1000 / 60; // minutos
    console.log(`🏁 Sesión PP finalizada: ${pair_session_id}`);
    console.log(`   Duración: ${duration.toFixed(1)} minutos`);
    console.log(`   Cambios de rol: ${ppSession.total_role_switches}`);
    console.log(`   Tareas completadas: ${ppSession.completed_tasks_count}`);

  } catch (error) {
    console.error('❌ Error al finalizar sesión de pair programming:', error);
    throw error;
  }
}

/**
 * ⭐ FUNCIÓN MODIFICADA: Procesar eventos de tareas
 */
async function processTaskEvent(event, activeUser, session_id, pair_session_id) {
  const { event_type, data } = event;

  // Buscar la sesión de pair programming activa
  const ppSession = await db.PairProgrammingSession.findOne({
    where: { 
      pair_session_id: pair_session_id,
      end_time: null
    }
  });

  if (!ppSession) {
    console.log('⚠️ No hay sesión PP activa para este evento de tarea');
    return;
  }

  if (event_type === 'TASK_CREATE') {
    ppSession.pending_tasks_count += 1;
    await ppSession.save();
    console.log(`📝 Tarea creada por ${activeUser?.email} (${data.current_role})`);
  } 
  else if (event_type === 'TASK_COMPLETE') {
    if (ppSession.pending_tasks_count > 0) {
      ppSession.pending_tasks_count -= 1;
    }
    ppSession.completed_tasks_count += 1;
    await ppSession.save();
    console.log(`✅ Tarea completada por ${activeUser?.email} (${data.current_role})`);
  }
  else if (event_type === 'TASK_EDIT') {
    console.log(`✏️ Tarea editada por ${activeUser?.email} (${data.current_role})`);
  }
  else if (event_type === 'TASK_DELETE') {
    if (ppSession.pending_tasks_count > 0) {
      ppSession.pending_tasks_count -= 1;
    }
    await ppSession.save();
    console.log(`🗑️ Tarea eliminada por ${activeUser?.email} (${data.current_role})`);
  }
}

/**
 * ⭐ NUEVA FUNCIÓN: Procesar snapshots de código
 */
async function processCodeSnapshot(event, activeUser, driverUser, navigatorUser) {
  const { data, pair_session_id, timestamp } = event;
  const { metadata, code_content } = data;

  try {
    await db.CodeSnapshot.create({
      snapshot_id: metadata.snapshot_id,
      pair_session_id: pair_session_id,
      
      // ⭐ USUARIOS
      author_user_id: activeUser ? activeUser.user_id : null,
      author_role: metadata.author_role, // 'driver' o 'navigator'
      driver_user_id: driverUser ? driverUser.user_id : null,
      navigator_user_id: navigatorUser ? navigatorUser.user_id : null,
      
      // METADATA DEL ARCHIVO
      file_name: metadata.file_name,
      file_path: metadata.file_path,
      language: metadata.language,
      workspace_name: metadata.workspace?.name,
      
      // MÉTRICAS
      line_count: metadata.metrics.line_count,
      char_count: metadata.metrics.char_count,
      lines_added: metadata.metrics.changes_since_last?.lines_added,
      chars_added: metadata.metrics.changes_since_last?.chars_added,
      
      // CONTEXTO
      task_id: metadata.task_id_context,
      git_branch: metadata.git_info?.branch,
      git_commit: metadata.git_info?.commit_hash,
      has_git_changes: metadata.git_info?.has_changes,
      
      // CONTENIDO
      code_content: code_content,
      
      timestamp: new Date(timestamp)
    });

    console.log(`💾 Snapshot guardado: ${metadata.file_name} por ${activeUser?.email} (${metadata.author_role})`);

  } catch (error) {
    console.error('❌ Error al guardar snapshot de código:', error);
    throw error;
  }
}

/**
 * ⭐ NUEVA FUNCIÓN: Procesar interacciones de chat
 */
async function processChatInteraction(event, activeUser, driverUser, navigatorUser) {
  const { data, conversation_id, pair_session_id, timestamp } = event;

  try {
    await db.ChatMessage.create({
      message_id: data.message_id,
      conversation_id: conversation_id,
      pair_session_id: pair_session_id,
      message_order: data.message_order,
      parent_message_id: data.parent_message_id,
      
      // ⭐ USUARIOS
      author_user_id: activeUser ? activeUser.user_id : null,
      author_role: data.author_role, // 'driver' o 'navigator'
      driver_user_id: driverUser ? driverUser.user_id : null,
      navigator_user_id: navigatorUser ? navigatorUser.user_id : null,
      
      // CONTENIDO
      message_type: data.message_type, // 'user_query' o 'bot_response'
      message_content: data.message_content,
      message_length: data.message_length,
      
      // CÓDIGO
      included_code: data.included_code,
      code_language: data.code_language,
      code_lines_count: data.code_lines_count,
      
      // CLASIFICACIÓN
      query_category: data.query_category,
      response_time_ms: data.response_time_ms,
      
      timestamp: new Date(timestamp)
    });

    const msgType = data.message_type === 'user_query' ? '❓' : '🤖';
    console.log(`${msgType} Chat: ${data.message_type} por ${activeUser?.email} (${data.author_role})`);

  } catch (error) {
    console.error('❌ Error al guardar mensaje de chat:', error);
    throw error;
  }
}

/**
 * Obtener resumen de analytics
 */
exports.getSummary = async (req, res) => {
  try {
    // Contar usuarios únicos
    const userCount = await db.User.count();

    // Contar sesiones
    const sessionCount = await db.Session.count();

    // Contar sesiones de pair programming
    const pairSessionCount = await db.PairProgrammingSession.count();

    // Contar eventos por tipo
    const eventTypeCount = await db.AnalyticsEvent.findAll({
      attributes: [
        'event_type',
        [db.sequelize.fn('COUNT', db.sequelize.col('event_type')), 'count']
      ],
      group: ['event_type'],
      order: [[db.sequelize.literal('count'), 'DESC']]
    });

    // Contar instantáneas de código
    const codeSnapshotCount = await db.CodeSnapshot.count();
    
    // Contar mensajes de chat
    const chatMessageCount = await db.ChatMessage.count();

    // Actividad reciente (últimas 24 horas)
    const recentActivity = await db.AnalyticsEvent.count({
      where: {
        timestamp: {
          [Op.gte]: new Date(Date.now() - 24 * 60 * 60 * 1000)
        }
      }
    });

    return res.status(200).json({
      user_count: userCount,
      session_count: sessionCount,
      pair_session_count: pairSessionCount,
      code_snapshot_count: codeSnapshotCount,
      chat_message_count: chatMessageCount,
      event_types: eventTypeCount,
      recent_activity: recentActivity
    });

  } catch (error) {
    console.error('Error al obtener resumen:', error);
    return res.status(500).json({ error: 'Error del servidor al obtener resumen' });
  }
};

/**
 * ⭐ FUNCIÓN MODIFICADA: Obtener datos de actividad de usuario
 */
exports.getUserActivity = async (req, res) => {
  try {
    const { email } = req.params;

    // Verificar que el email existe
    const user = await db.User.findOne({ where: { email } });
    if (!user) {
      return res.status(404).json({ error: 'Usuario no encontrado' });
    }

    // ⭐ Obtener eventos donde el usuario fue el autor
    const events = await db.AnalyticsEvent.findAll({
      where: { user_id: user.user_id },
      order: [['timestamp', 'DESC']],
      limit: 100
    });

    // Contar eventos por tipo
    const eventsByType = await db.AnalyticsEvent.findAll({
      attributes: [
        'event_type',
        [db.sequelize.fn('COUNT', db.sequelize.col('event_type')), 'count']
      ],
      where: { user_id: user.user_id },
      group: ['event_type'],
      order: [[db.sequelize.literal('count'), 'DESC']]
    });

    // ⭐ Obtener snapshots donde el usuario fue el autor
    const codeSnapshots = await db.CodeSnapshot.findAll({
      attributes: [
        'snapshot_id', 'file_name', 'language', 'line_count', 
        'char_count', 'author_role', 'timestamp'
      ],
      where: { author_user_id: user.user_id },
      order: [['timestamp', 'DESC']],
      limit: 20
    });
    
    // ⭐ Obtener mensajes de chat del usuario
    const chatMessages = await db.ChatMessage.findAll({
      where: { author_user_id: user.user_id },
      order: [['timestamp', 'DESC']],
      limit: 50
    });
    
    // ⭐ Obtener sesiones de PP donde participó (como driver o navigator)
    const pairSessions = await db.PairProgrammingSession.findAll({
      where: {
        [Op.or]: [
          { driver_id: user.user_id },
          { navigator_id: user.user_id }
        ]
      },
      order: [['start_time', 'DESC']],
      limit: 10
    });

    return res.status(200).json({
      user: {
        email: user.email,
        university_domain: user.university_domain,
        created_at: user.created_at,
        last_active_at: user.last_active_at
      },
      events_by_type: eventsByType,
      recent_events: events,
      code_snapshots: codeSnapshots,
      chat_messages: chatMessages,
      pair_sessions: pairSessions
    });

  } catch (error) {
    console.error('Error al obtener actividad de usuario:', error);
    return res.status(500).json({ error: 'Error del servidor al obtener actividad de usuario' });
  }
};

/**
 * ⭐ NUEVA FUNCIÓN: Obtener estadísticas de una sesión de pair programming
 */
exports.getPairSessionStats = async (req, res) => {
  try {
    const { pair_session_id } = req.params;

    const ppSession = await db.PairProgrammingSession.findOne({
      where: { pair_session_id },
      include: [
        { model: db.User, as: 'driver', attributes: ['email', 'university_domain'] },
        { model: db.User, as: 'navigator', attributes: ['email', 'university_domain'] }
      ]
    });

    if (!ppSession) {
      return res.status(404).json({ error: 'Sesión de pair programming no encontrada' });
    }

    // Obtener eventos de la sesión
    const events = await db.AnalyticsEvent.findAll({
      where: { pair_session_id },
      order: [['timestamp', 'ASC']]
    });

    // Obtener snapshots de código
    const codeSnapshots = await db.CodeSnapshot.findAll({
      where: { pair_session_id },
      order: [['timestamp', 'ASC']]
    });
    
    // Contar snapshots por autor
    const snapshotsByAuthor = await db.CodeSnapshot.findAll({
      attributes: [
        'author_role',
        [db.sequelize.fn('COUNT', db.sequelize.col('snapshot_id')), 'count']
      ],
      where: { pair_session_id },
      group: ['author_role']
    });

    // Obtener mensajes de chat
    const chatMessages = await db.ChatMessage.findAll({
      where: { pair_session_id },
      order: [['message_order', 'ASC']]
    });
    
    // Contar mensajes por autor
    const messagesByAuthor = await db.ChatMessage.findAll({
      attributes: [
        'author_role',
        [db.sequelize.fn('COUNT', db.sequelize.col('message_id')), 'count']
      ],
      where: { 
        pair_session_id,
        message_type: 'user_query'
      },
      group: ['author_role']
    });

    return res.status(200).json({
      session: ppSession,
      events_count: events.length,
      code_snapshots_count: codeSnapshots.length,
      code_snapshots_by_author: snapshotsByAuthor,
      chat_messages_count: chatMessages.length,
      messages_by_author: messagesByAuthor,
      timeline: events.map(e => ({
        timestamp: e.timestamp,
        event_type: e.event_type,
        author_role: e.event_data?.author_role
      }))
    });

  } catch (error) {
    console.error('Error al obtener estadísticas de sesión PP:', error);
    return res.status(500).json({ error: 'Error del servidor' });
  }
};

module.exports = exports;

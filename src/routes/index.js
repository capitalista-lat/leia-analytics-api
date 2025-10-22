/**
 * ROUTES - index.js ACTUALIZADO
 * Soporte para 2 usuarios en pair programming
 */

const express = require('express');
const router = express.Router();
const analyticsController = require('../controllers/analyticsController');
const { simplifiedAuth } = require('../middlewares/auth');
const db = require('../models');
const { Op } = require('sequelize');

// ============================================================================
// RUTAS PRINCIPALES DE ANALYTICS
// ============================================================================

/**
 * ⭐ MODIFICADO: Cambiar de processEvents a receiveEvents
 */
router.post('/analytics', simplifiedAuth, analyticsController.receiveEvents);

router.get('/analytics/summary', simplifiedAuth, analyticsController.getSummary);

router.get('/analytics/user/:email', simplifiedAuth, analyticsController.getUserActivity);

// ============================================================================
// RUTAS DE CODE SNAPSHOTS (⭐ ACTUALIZADAS)
// ============================================================================

/**
 * ⭐ MODIFICADO: Usar author_user_id en lugar de user_id
 * Obtener todas las instantáneas de código de un usuario
 */
router.get('/analytics/code-snapshots/user/:email', simplifiedAuth, async (req, res) => {
  try {
    const { email } = req.params;
    
    // Verificar que el email existe
    const user = await db.User.findOne({ where: { email } });
    if (!user) {
      return res.status(404).json({ error: 'Usuario no encontrado' });
    }
    
    // ⭐ MODIFICADO: Usar author_user_id y nuevos campos
    const snapshots = await db.CodeSnapshot.findAll({
      attributes: [
        'snapshot_id', 
        'file_name', 
        'language', 
        'line_count', 
        'char_count', 
        'author_role',        // ⭐ NUEVO
        'workspace_name',     // ⭐ NUEVO
        'timestamp'
      ],
      where: { author_user_id: user.user_id },  // ⭐ MODIFICADO
      order: [['timestamp', 'DESC']],
      limit: 100
    });
    
    return res.status(200).json({
      user_email: email,
      snapshots_count: snapshots.length,
      snapshots
    });
    
  } catch (error) {
    console.error('Error al obtener instantáneas de código:', error);
    return res.status(500).json({ 
      error: 'Error del servidor al obtener instantáneas de código' 
    });
  }
});

/**
 * Obtener una instantánea específica con su contenido completo
 */
router.get('/analytics/code-snapshots/:snapshotId', simplifiedAuth, async (req, res) => {
  try {
    const { snapshotId } = req.params;
    
    const snapshot = await db.CodeSnapshot.findByPk(snapshotId, {
      include: [
        {
          model: db.User,
          as: 'author',
          attributes: ['email', 'university_domain']
        },
        {
          model: db.User,
          as: 'driver',
          attributes: ['email']
        },
        {
          model: db.User,
          as: 'navigator',
          attributes: ['email']
        }
      ]
    });
    
    if (!snapshot) {
      return res.status(404).json({ error: 'Instantánea no encontrada' });
    }
    
    return res.status(200).json(snapshot);
    
  } catch (error) {
    console.error('Error al obtener instantánea de código:', error);
    return res.status(500).json({ 
      error: 'Error del servidor al obtener instantánea de código' 
    });
  }
});

/**
 * ⭐ MODIFICADO: Usar pair_session_id en lugar de session_id
 * Obtener instantáneas por sesión de pair programming
 */
router.get('/analytics/code-snapshots/session/:pairSessionId', simplifiedAuth, async (req, res) => {
  try {
    const { pairSessionId } = req.params;
    
    const snapshots = await db.CodeSnapshot.findAll({
      attributes: [
        'snapshot_id', 
        'file_name', 
        'language', 
        'line_count', 
        'char_count', 
        'author_role',        // ⭐ NUEVO
        'lines_added',        // ⭐ NUEVO
        'chars_added',        // ⭐ NUEVO
        'timestamp'
      ],
      where: { pair_session_id: pairSessionId },  // ⭐ MODIFICADO
      include: [
        {
          model: db.User,
          as: 'author',
          attributes: ['email']
        }
      ],
      order: [['timestamp', 'ASC']]
    });
    
    return res.status(200).json({
      pair_session_id: pairSessionId,
      snapshots_count: snapshots.length,
      snapshots
    });
    
  } catch (error) {
    console.error('Error al obtener instantáneas de sesión:', error);
    return res.status(500).json({ 
      error: 'Error del servidor al obtener instantáneas de sesión' 
    });
  }
});

// ============================================================================
// RUTAS DE CHAT MESSAGES (⭐ NUEVAS)
// ============================================================================

/**
 * ⭐ NUEVA: Obtener mensajes de chat de un usuario
 */
router.get('/analytics/chat-messages/user/:email', simplifiedAuth, async (req, res) => {
  try {
    const { email } = req.params;
    
    const user = await db.User.findOne({ where: { email } });
    if (!user) {
      return res.status(404).json({ error: 'Usuario no encontrado' });
    }
    
    const messages = await db.ChatMessage.findAll({
      where: { author_user_id: user.user_id },
      attributes: [
        'message_id',
        'conversation_id',
        'message_type',
        'message_content',
        'author_role',
        'included_code',
        'query_category',
        'timestamp'
      ],
      order: [['timestamp', 'DESC']],
      limit: 100
    });
    
    return res.status(200).json({
      user_email: email,
      messages_count: messages.length,
      messages
    });
    
  } catch (error) {
    console.error('Error al obtener mensajes de chat:', error);
    return res.status(500).json({ error: 'Error del servidor' });
  }
});

/**
 * ⭐ NUEVA: Obtener conversación completa
 */
router.get('/analytics/chat-messages/conversation/:conversationId', simplifiedAuth, async (req, res) => {
  try {
    const { conversationId } = req.params;
    
    const messages = await db.ChatMessage.findAll({
      where: { conversation_id: conversationId },
      include: [
        {
          model: db.User,
          as: 'author',
          attributes: ['email']
        }
      ],
      order: [['message_order', 'ASC']]
    });
    
    return res.status(200).json({
      conversation_id: conversationId,
      messages_count: messages.length,
      messages
    });
    
  } catch (error) {
    console.error('Error al obtener conversación:', error);
    return res.status(500).json({ error: 'Error del servidor' });
  }
});

/**
 * ⭐ NUEVA: Obtener mensajes de una sesión de pair programming
 */
router.get('/analytics/chat-messages/pair-session/:pairSessionId', simplifiedAuth, async (req, res) => {
  try {
    const { pairSessionId } = req.params;
    
    const messages = await db.ChatMessage.findAll({
      where: { pair_session_id: pairSessionId },
      include: [
        {
          model: db.User,
          as: 'author',
          attributes: ['email']
        }
      ],
      order: [['timestamp', 'ASC']]
    });
    
    // Contar mensajes por autor
    const messagesByAuthor = await db.ChatMessage.findAll({
      attributes: [
        'author_role',
        [db.sequelize.fn('COUNT', db.sequelize.col('message_id')), 'count']
      ],
      where: { 
        pair_session_id: pairSessionId,
        message_type: 'user_query'
      },
      group: ['author_role']
    });
    
    return res.status(200).json({
      pair_session_id: pairSessionId,
      messages_count: messages.length,
      messages_by_author: messagesByAuthor,
      messages
    });
    
  } catch (error) {
    console.error('Error al obtener mensajes de PP:', error);
    return res.status(500).json({ error: 'Error del servidor' });
  }
});

// ============================================================================
// RUTAS DE PAIR PROGRAMMING (⭐ ACTUALIZADAS)
// ============================================================================

/**
 * ⭐ MODIFICADO: Usar asociaciones con minúsculas (driver, navigator)
 * Obtener sesiones de pair programming de un usuario
 */
router.get('/analytics/pair-programming/user/:email', simplifiedAuth, async (req, res) => {
  try {
    const { email } = req.params;
    
    const user = await db.User.findOne({ where: { email } });
    if (!user) {
      return res.status(404).json({ error: 'Usuario no encontrado' });
    }
    
    // ⭐ MODIFICADO: Usar 'driver' y 'navigator' en minúsculas
    const ppSessions = await db.PairProgrammingSession.findAll({
      where: {
        [Op.or]: [
          { driver_id: user.user_id },
          { navigator_id: user.user_id }
        ]
      },
      include: [
        {
          model: db.User,
          as: 'driver',           // ⭐ MODIFICADO: minúscula
          attributes: ['email']
        },
        {
          model: db.User,
          as: 'navigator',        // ⭐ MODIFICADO: minúscula
          attributes: ['email']
        },
        {
          model: db.User,
          as: 'currentDriver',    // ⭐ NUEVO
          attributes: ['email']
        }
      ],
      order: [['start_time', 'DESC']]
    });
    
    // Calcular estadísticas del usuario en PP
    const stats = {
      total_sessions: ppSessions.length,
      as_driver: ppSessions.filter(s => s.driver_id === user.user_id).length,
      as_navigator: ppSessions.filter(s => s.navigator_id === user.user_id).length,
      total_role_switches: ppSessions.reduce((sum, s) => sum + (s.total_role_switches || 0), 0),
      total_tasks_completed: ppSessions.reduce((sum, s) => sum + (s.completed_tasks_count || 0), 0)
    };
    
    return res.status(200).json({
      user_email: email,
      stats,
      sessions: ppSessions
    });
    
  } catch (error) {
    console.error('Error al obtener sesiones de pair programming:', error);
    return res.status(500).json({ error: 'Error del servidor' });
  }
});

/**
 * Obtener estadísticas generales de pair programming
 */
router.get('/analytics/pair-programming/stats', simplifiedAuth, async (req, res) => {
  try {
    const totalSessions = await db.PairProgrammingSession.count();
    const activeSessions = await db.PairProgrammingSession.count({
      where: { end_time: null }
    });
    const completedSessions = await db.PairProgrammingSession.count({
      where: { end_time: { [Op.not]: null } }
    });
    
    // Promedio de cambios de rol
    const avgRoleSwitches = await db.PairProgrammingSession.findOne({
      attributes: [
        [db.sequelize.fn('AVG', db.sequelize.col('total_role_switches')), 'avg_switches']
      ],
      where: { end_time: { [Op.not]: null } }
    });
    
    // Promedio de tareas completadas
    const avgCompletedTasks = await db.PairProgrammingSession.findOne({
      attributes: [
        [db.sequelize.fn('AVG', db.sequelize.col('completed_tasks_count')), 'avg_completed']
      ],
      where: { end_time: { [Op.not]: null } }
    });
    
    // Promedio de duración de sesiones
    const avgDuration = await db.sequelize.query(`
      SELECT AVG(EXTRACT(EPOCH FROM (end_time - start_time)) / 60) as avg_minutes
      FROM pair_programming_sessions
      WHERE end_time IS NOT NULL
    `, { type: db.sequelize.QueryTypes.SELECT });
    
    return res.status(200).json({
      total_sessions: totalSessions,
      active_sessions: activeSessions,
      completed_sessions: completedSessions,
      avg_role_switches: parseFloat(avgRoleSwitches?.dataValues?.avg_switches || 0).toFixed(2),
      avg_completed_tasks: parseFloat(avgCompletedTasks?.dataValues?.avg_completed || 0).toFixed(2),
      avg_duration_minutes: parseFloat(avgDuration[0]?.avg_minutes || 0).toFixed(2)
    });
    
  } catch (error) {
    console.error('Error al obtener estadísticas de pair programming:', error);
    return res.status(500).json({ error: 'Error del servidor' });
  }
});

/**
 * ⭐ NUEVA: Obtener estadísticas detalladas de una sesión específica
 * Esta es la ruta que faltaba del controller
 */
router.get('/analytics/pair-programming/session/:pairSessionId', simplifiedAuth, analyticsController.getPairSessionStats);

/**
 * ⭐ NUEVA: Comparar participación de usuarios en una sesión
 */
router.get('/analytics/pair-programming/session/:pairSessionId/balance', simplifiedAuth, async (req, res) => {
  try {
    const { pairSessionId } = req.params;
    
    // Obtener la sesión
    const ppSession = await db.PairProgrammingSession.findOne({
      where: { pair_session_id: pairSessionId },
      include: [
        { model: db.User, as: 'driver', attributes: ['email', 'user_id'] },
        { model: db.User, as: 'navigator', attributes: ['email', 'user_id'] }
      ]
    });
    
    if (!ppSession) {
      return res.status(404).json({ error: 'Sesión no encontrada' });
    }
    
    // Contar eventos por usuario
    const eventsByUser = await db.AnalyticsEvent.findAll({
      attributes: [
        'user_id',
        [db.sequelize.fn('COUNT', db.sequelize.col('event_id')), 'count']
      ],
      where: { pair_session_id: pairSessionId },
      group: ['user_id'],
      include: [
        { model: db.User, as: 'activeUser', attributes: ['email'] }
      ]
    });
    
    // Contar snapshots de código por autor
    const snapshotsByAuthor = await db.CodeSnapshot.findAll({
      attributes: [
        'author_user_id',
        'author_role',
        [db.sequelize.fn('COUNT', db.sequelize.col('snapshot_id')), 'count'],
        [db.sequelize.fn('SUM', db.sequelize.col('lines_added')), 'total_lines']
      ],
      where: { pair_session_id: pairSessionId },
      group: ['author_user_id', 'author_role'],
      include: [
        { model: db.User, as: 'author', attributes: ['email'] }
      ]
    });
    
    // Contar mensajes por autor
    const messagesByAuthor = await db.ChatMessage.findAll({
      attributes: [
        'author_user_id',
        'author_role',
        [db.sequelize.fn('COUNT', db.sequelize.col('message_id')), 'count']
      ],
      where: { 
        pair_session_id: pairSessionId,
        message_type: 'user_query'
      },
      group: ['author_user_id', 'author_role'],
      include: [
        { model: db.User, as: 'author', attributes: ['email'] }
      ]
    });
    
    return res.status(200).json({
      session: {
        pair_session_id: pairSessionId,
        driver: ppSession.driver.email,
        navigator: ppSession.navigator.email,
        total_switches: ppSession.total_role_switches
      },
      participation: {
        events: eventsByUser,
        code_snapshots: snapshotsByAuthor,
        chat_messages: messagesByAuthor
      }
    });
    
  } catch (error) {
    console.error('Error al calcular balance de participación:', error);
    return res.status(500).json({ error: 'Error del servidor' });
  }
});

// ============================================================================
// RUTAS DE ANÁLISIS (⭐ NUEVAS)
// ============================================================================

/**
 * ⭐ NUEVA: Timeline de eventos de una sesión de PP
 */
router.get('/analytics/timeline/:pairSessionId', simplifiedAuth, async (req, res) => {
  try {
    const { pairSessionId } = req.params;
    
    // Obtener todos los eventos de la sesión
    const events = await db.AnalyticsEvent.findAll({
      where: { pair_session_id: pairSessionId },
      include: [
        { model: db.User, as: 'activeUser', attributes: ['email'] }
      ],
      order: [['timestamp', 'ASC']]
    });
    
    // Obtener snapshots
    const snapshots = await db.CodeSnapshot.findAll({
      where: { pair_session_id: pairSessionId },
      attributes: ['snapshot_id', 'file_name', 'author_role', 'timestamp'],
      include: [
        { model: db.User, as: 'author', attributes: ['email'] }
      ],
      order: [['timestamp', 'ASC']]
    });
    
    // Obtener mensajes
    const messages = await db.ChatMessage.findAll({
      where: { pair_session_id: pairSessionId },
      attributes: ['message_id', 'message_type', 'author_role', 'timestamp'],
      include: [
        { model: db.User, as: 'author', attributes: ['email'] }
      ],
      order: [['timestamp', 'ASC']]
    });
    
    // Combinar y ordenar todo por timestamp
    const timeline = [
      ...events.map(e => ({
        type: 'event',
        event_type: e.event_type,
        author: e.activeUser?.email,
        timestamp: e.timestamp
      })),
      ...snapshots.map(s => ({
        type: 'code_snapshot',
        file: s.file_name,
        author: s.author?.email,
        role: s.author_role,
        timestamp: s.timestamp
      })),
      ...messages.map(m => ({
        type: 'chat_message',
        message_type: m.message_type,
        author: m.author?.email,
        role: m.author_role,
        timestamp: m.timestamp
      }))
    ].sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp));
    
    return res.status(200).json({
      pair_session_id: pairSessionId,
      timeline_count: timeline.length,
      timeline
    });
    
  } catch (error) {
    console.error('Error al obtener timeline:', error);
    return res.status(500).json({ error: 'Error del servidor' });
  }
});

/**
 * ⭐ NUEVA: Análisis de productividad por rol
 */
router.get('/analytics/productivity/role-analysis', simplifiedAuth, async (req, res) => {
  try {
    // Análisis de código por rol
    const codeByRole = await db.CodeSnapshot.findAll({
      attributes: [
        'author_role',
        [db.sequelize.fn('COUNT', db.sequelize.col('snapshot_id')), 'snapshot_count'],
        [db.sequelize.fn('AVG', db.sequelize.col('line_count')), 'avg_lines'],
        [db.sequelize.fn('SUM', db.sequelize.col('lines_added')), 'total_lines_added']
      ],
      group: ['author_role'],
      where: {
        author_role: { [Op.not]: null }
      }
    });
    
    // Análisis de mensajes por rol
    const messagesByRole = await db.ChatMessage.findAll({
      attributes: [
        'author_role',
        [db.sequelize.fn('COUNT', db.sequelize.col('message_id')), 'message_count'],
        [db.sequelize.fn('AVG', db.sequelize.col('message_length')), 'avg_length']
      ],
      group: ['author_role'],
      where: {
        message_type: 'user_query',
        author_role: { [Op.not]: null }
      }
    });
    
    return res.status(200).json({
      code_productivity: codeByRole,
      chat_engagement: messagesByRole
    });
    
  } catch (error) {
    console.error('Error en análisis de productividad:', error);
    return res.status(500).json({ error: 'Error del servidor' });
  }
});

module.exports = router;

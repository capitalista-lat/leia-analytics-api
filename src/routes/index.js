const express = require('express');
const router = express.Router();
const analyticsController = require('../controllers/analyticsController');
const { simplifiedAuth } = require('../middlewares/auth');
const db = require('../models'); // Add this missing import

// Rutas para analytics
router.post('/analytics', simplifiedAuth, analyticsController.processEvents);
router.get('/analytics/summary', simplifiedAuth, analyticsController.getSummary);
router.get('/analytics/user/:email', simplifiedAuth, analyticsController.getUserActivity);

// Ruta para obtener todas las instantáneas de código de un usuario
router.get('/analytics/code-snapshots/user/:email', simplifiedAuth, async (req, res) => {
    try {
      const { email } = req.params;
      
      // Verificar que el email existe
      const user = await db.User.findOne({ where: { email } });
      if (!user) {
        return res.status(404).json({ error: 'Usuario no encontrado' });
      }
      
      // Obtener instantáneas de código (solo metadata, sin contenido completo)
      const snapshots = await db.CodeSnapshot.findAll({
        attributes: [
          'snapshot_id', 'file_name', 'language', 'line_count', 
          'char_count', 'timestamp', 'pair_session_info'
        ],
        where: { user_id: user.user_id },
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
      return res.status(500).json({ error: 'Error del servidor al obtener instantáneas de código' });
    }
  });
  
  // Ruta para obtener una instantánea específica con su contenido
  router.get('/analytics/code-snapshots/:snapshotId', simplifiedAuth, async (req, res) => {
    try {
      const { snapshotId } = req.params;
      
      const snapshot = await db.CodeSnapshot.findByPk(snapshotId);
      if (!snapshot) {
        return res.status(404).json({ error: 'Instantánea no encontrada' });
      }
      
      return res.status(200).json(snapshot);
    } catch (error) {
      console.error('Error al obtener instantánea de código:', error);
      return res.status(500).json({ error: 'Error del servidor al obtener instantánea de código' });
    }
  });
  
  // Ruta para obtener instantáneas por sesión
  router.get('/analytics/code-snapshots/session/:sessionId', simplifiedAuth, async (req, res) => {
    try {
      const { sessionId } = req.params;
      
      const snapshots = await db.CodeSnapshot.findAll({
        attributes: [
          'snapshot_id', 'file_name', 'language', 'line_count', 
          'char_count', 'timestamp', 'pair_session_info'
        ],
        where: { session_id: sessionId },
        order: [['timestamp', 'ASC']]
      });
      
      return res.status(200).json({
        session_id: sessionId,
        snapshots_count: snapshots.length,
        snapshots
      });
    } catch (error) {
      console.error('Error al obtener instantáneas de sesión:', error);
      return res.status(500).json({ error: 'Error del servidor al obtener instantáneas de sesión' });
    }
  });

  router.get('/analytics/pair-programming/user/:email', simplifiedAuth, async (req, res) => {
  try {
    const { email } = req.params;
    const db = require('../models');
    
    // Verificar que el email existe
    const user = await db.User.findOne({ where: { email } });
    if (!user) {
      return res.status(404).json({ error: 'Usuario no encontrado' });
    }
    
    // Obtener sesiones de pair programming donde el usuario participó
    const ppSessions = await db.PairProgrammingSession.findAll({
      where: {
        [db.Sequelize.Op.or]: [
          { driver_id: user.user_id },
          { navigator_id: user.user_id }
        ]
      },
      include: [
        {
          model: db.User,
          as: 'Driver',
          attributes: ['email']
        },
        {
          model: db.User,
          as: 'Navigator',
          attributes: ['email']
        }
      ],
      order: [['start_time', 'DESC']]
    });
    
    return res.status(200).json({
      user_email: email,
      total_sessions: ppSessions.length,
      sessions: ppSessions
    });
    
  } catch (error) {
    console.error('Error al obtener sesiones de pair programming:', error);
    return res.status(500).json({ error: 'Error del servidor' });
  }
});

// Ruta para obtener estadísticas de pair programming
router.get('/analytics/pair-programming/stats', simplifiedAuth, async (req, res) => {
  try {
    const db = require('../models');
    
    // Estadísticas generales
    const totalSessions = await db.PairProgrammingSession.count();
    const activeSessions = await db.PairProgrammingSession.count({
      where: { end_time: null }
    });
    const completedSessions = await db.PairProgrammingSession.count({
      where: { end_time: { [db.Sequelize.Op.not]: null } }
    });
    
    // Promedio de cambios de rol
    const avgRoleSwitches = await db.PairProgrammingSession.findOne({
      attributes: [
        [db.sequelize.fn('AVG', db.sequelize.col('total_role_switches')), 'avg_switches']
      ],
      where: { end_time: { [db.Sequelize.Op.not]: null } }
    });
    
    // Promedio de tareas completadas
    const avgCompletedTasks = await db.PairProgrammingSession.findOne({
      attributes: [
        [db.sequelize.fn('AVG', db.sequelize.col('completed_tasks_count')), 'avg_completed']
      ],
      where: { end_time: { [db.Sequelize.Op.not]: null } }
    });
    
    return res.status(200).json({
      total_sessions: totalSessions,
      active_sessions: activeSessions,
      completed_sessions: completedSessions,
      avg_role_switches: parseFloat(avgRoleSwitches?.dataValues?.avg_switches || 0).toFixed(2),
      avg_completed_tasks: parseFloat(avgCompletedTasks?.dataValues?.avg_completed || 0).toFixed(2)
    });
    
  } catch (error) {
    console.error('Error al obtener estadísticas de pair programming:', error);
    return res.status(500).json({ error: 'Error del servidor' });
  }
});

module.exports = router;

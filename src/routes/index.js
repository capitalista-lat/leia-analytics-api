const express = require('express');
const router = express.Router();
const analyticsController = require('../controllers/analyticsController');
const { simplifiedAuth } = require('../middlewares/auth');

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

module.exports = router;

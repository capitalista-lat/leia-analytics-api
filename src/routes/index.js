const express = require('express');
const router = express.Router();
const analyticsController = require('../controllers/analyticsController');
const { simplifiedAuth } = require('../middlewares/auth');

// Rutas para analytics
router.post('/analytics', simplifiedAuth, analyticsController.processEvents);
router.get('/analytics/summary', simplifiedAuth, analyticsController.getSummary);
router.get('/analytics/user/:email', simplifiedAuth, analyticsController.getUserActivity);

module.exports = router;

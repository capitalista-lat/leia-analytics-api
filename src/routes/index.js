const express = require('express');
const router = express.Router();
const { receiveEvents, exportAnalytics } = require('../controllers/analyticsController');
const db = require('../models');
const { Op } = require('sequelize');

/**
 * Middleware de autenticación simplificado para desarrollo
 */
const simplifiedAuth = (req, res, next) => {
    console.log('Middleware simplifiedAuth activado - MODO DESARROLLO');
    next();
};

/**
 * Ruta para recibir eventos de analytics
 * POST /api/analytics
 */
router.post('/analytics', receiveEvents);

/**
 * Ruta para exportar analytics (para administradores)
 * GET /api/analytics/export
 */
router.get('/analytics/export', exportAnalytics);

/**
 * Ruta de prueba
 * GET /api/test
 */
router.get('/test', (req, res) => {
    res.json({ 
        message: 'API funcionando correctamente',
        endpoints: {
            analytics: 'POST /api/analytics',
            export: 'GET /api/analytics/export',
            test: 'GET /api/test'
        },
        timestamp: new Date().toISOString() 
    });
});

/**
 * ⭐ NUEVA: Obtener sesiones de pair programming
 * GET /api/analytics/pair-sessions
 */
router.get('/analytics/pair-sessions', simplifiedAuth, async (req, res) => {
    try {
        const sessions = await db.PairProgrammingSession.findAll({
            include: [
                {
                    model: db.User,
                    as: 'driver',
                    attributes: ['user_id', 'email']
                },
                {
                    model: db.User,
                    as: 'navigator',
                    attributes: ['user_id', 'email']
                },
                {
                    model: db.User,
                    as: 'currentDriver',
                    attributes: ['user_id', 'email']
                }
            ],
            order: [['start_time', 'DESC']],
            limit: 100
        });

        return res.status(200).json({
            total: sessions.length,
            sessions
        });

    } catch (error) {
        console.error('Error al obtener sesiones de pair programming:', error);
        return res.status(500).json({ error: 'Error del servidor' });
    }
});

/**
 * ⭐ NUEVA: Obtener conversaciones de chat
 * GET /api/analytics/conversations
 */
router.get('/analytics/conversations', simplifiedAuth, async (req, res) => {
    try {
        const { conversation_id, pair_session_id } = req.query;

        const whereClause = {};
        if (conversation_id) {
            whereClause.conversation_id = conversation_id;
        }
        if (pair_session_id) {
            whereClause.pair_session_id = pair_session_id;
        }

        const messages = await db.ChatMessage.findAll({
            where: whereClause,
            include: [
                {
                    model: db.User,
                    as: 'author',
                    attributes: ['user_id', 'email']
                },
                {
                    model: db.User,
                    as: 'driver',
                    attributes: ['user_id', 'email']
                },
                {
                    model: db.User,
                    as: 'navigator',
                    attributes: ['user_id', 'email']
                }
            ],
            order: [['message_order', 'ASC']],
            limit: 500
        });

        // Agrupar por conversación
        const conversations = {};
        messages.forEach(msg => {
            if (!conversations[msg.conversation_id]) {
                conversations[msg.conversation_id] = {
                    conversation_id: msg.conversation_id,
                    pair_session_id: msg.pair_session_id,
                    messages: []
                };
            }
            conversations[msg.conversation_id].messages.push(msg);
        });

        return res.status(200).json({
            total_messages: messages.length,
            conversations: Object.values(conversations)
        });

    } catch (error) {
        console.error('Error al obtener conversaciones:', error);
        return res.status(500).json({ error: 'Error del servidor' });
    }
});

/**
 * ⭐ NUEVA: Obtener snapshots de código
 * GET /api/analytics/code-snapshots
 */
router.get('/analytics/code-snapshots', simplifiedAuth, async (req, res) => {
    try {
        const { user_id, session_id, pair_session_id, language } = req.query;

        const whereClause = {};
        if (user_id) whereClause.user_id = user_id;
        if (session_id) whereClause.session_id = session_id;
        if (pair_session_id) whereClause.pair_session_id = pair_session_id;
        if (language) whereClause.language = language;

        const snapshots = await db.CodeSnapshot.findAll({
            where: whereClause,
            include: [
                {
                    model: db.User,
                    as: 'user',
                    attributes: ['user_id', 'email']
                },
                {
                    model: db.User,
                    as: 'author',
                    attributes: ['user_id', 'email']
                },
                {
                    model: db.User,
                    as: 'driver',
                    attributes: ['user_id', 'email']
                },
                {
                    model: db.User,
                    as: 'navigator',
                    attributes: ['user_id', 'email']
                }
            ],
            order: [['timestamp', 'DESC']],
            limit: 100
        });

        return res.status(200).json({
            total: snapshots.length,
            snapshots
        });

    } catch (error) {
        console.error('Error al obtener snapshots:', error);
        return res.status(500).json({ error: 'Error del servidor' });
    }
});

/**
 * ⭐ NUEVA: Estadísticas generales
 * GET /api/analytics/stats
 */
router.get('/analytics/stats', simplifiedAuth, async (req, res) => {
    try {
        // Total de usuarios
        const totalUsers = await db.User.count();

        // Total de sesiones
        const totalSessions = await db.Session.count();

        // Total de sesiones de pair programming
        const totalPairSessions = await db.PairProgrammingSession.count();

        // Total de mensajes de chat
        const totalChatMessages = await db.ChatMessage.count();

        // Total de code snapshots
        const totalCodeSnapshots = await db.CodeSnapshot.count();

        // Total de eventos
        const totalEvents = await db.AnalyticsEvent.count();

        // Usuarios más activos
        const topUsers = await db.AnalyticsEvent.findAll({
            attributes: [
                'user_id',
                [db.sequelize.fn('COUNT', db.sequelize.col('event_id')), 'event_count']
            ],
            include: [
                {
                    model: db.User,
                    as: 'user',
                    attributes: ['email']
                }
            ],
            group: ['user_id', 'user.user_id'],
            order: [[db.sequelize.fn('COUNT', db.sequelize.col('event_id')), 'DESC']],
            limit: 10
        });

        // Tipos de eventos más comunes
        const eventTypes = await db.AnalyticsEvent.findAll({
            attributes: [
                'event_type',
                [db.sequelize.fn('COUNT', db.sequelize.col('event_id')), 'count']
            ],
            group: ['event_type'],
            order: [[db.sequelize.fn('COUNT', db.sequelize.col('event_id')), 'DESC']]
        });

        return res.status(200).json({
            summary: {
                total_users: totalUsers,
                total_sessions: totalSessions,
                total_pair_sessions: totalPairSessions,
                total_chat_messages: totalChatMessages,
                total_code_snapshots: totalCodeSnapshots,
                total_events: totalEvents
            },
            top_users: topUsers,
            event_types: eventTypes
        });

    } catch (error) {
        console.error('Error al obtener estadísticas:', error);
        return res.status(500).json({ error: 'Error del servidor' });
    }
});

/**
 * ⭐ NUEVA: Timeline de una sesión de pair programming
 * GET /api/analytics/pair-session/:pairSessionId/timeline
 */
router.get('/analytics/pair-session/:pairSessionId/timeline', simplifiedAuth, async (req, res) => {
    try {
        const { pairSessionId } = req.params;

        // Obtener todos los eventos relacionados
        const [messages, snapshots, roleChanges] = await Promise.all([
            db.ChatMessage.findAll({
                where: { pair_session_id: pairSessionId },
                attributes: ['message_id', 'message_type', 'message_content', 'author_role', 'timestamp'],
                order: [['timestamp', 'ASC']]
            }),
            db.CodeSnapshot.findAll({
                where: { pair_session_id: pairSessionId },
                attributes: ['snapshot_id', 'file_name', 'language', 'line_count', 'author_role', 'timestamp'],
                order: [['timestamp', 'ASC']]
            }),
            db.AnalyticsEvent.findAll({
                where: { 
                    pair_session_id: pairSessionId,
                    event_type: 'PAIR_ROLE_SWITCH'
                },
                attributes: ['event_id', 'event_type', 'data', 'timestamp'],
                order: [['timestamp', 'ASC']]
            })
        ]);

        // Combinar y ordenar cronológicamente
        const timeline = [
            ...messages.map(m => ({
                type: 'chat_message',
                id: m.message_id,
                message_type: m.message_type,
                content: m.message_content,
                role: m.author_role,
                timestamp: m.timestamp
            })),
            ...snapshots.map(s => ({
                type: 'code_snapshot',
                id: s.snapshot_id,
                file_name: s.file_name,
                language: s.language,
                line_count: s.line_count,
                role: s.author_role,
                timestamp: s.timestamp
            })),
            ...roleChanges.map(r => ({
                type: 'role_switch',
                id: r.event_id,
                data: r.data,
                timestamp: r.timestamp
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
 * GET /api/analytics/productivity/role-analysis
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

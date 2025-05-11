const db = require('../models');
const { Op } = require('sequelize');

// Procesar eventos entrantes
exports.processEvents = async (req, res) => {
  try {
    const { events } = req.body;
    
    if (!Array.isArray(events) || events.length === 0) {
      return res.status(400).json({ error: 'Se requiere un array de eventos no vacío' });
    }
    
    const results = [];
    
    for (const event of events) {
      // Verificar que el evento tenga los campos necesarios
      if (!event.event_type || !event.timestamp || !event.user_email) {
        results.push({ 
          status: 'error', 
          message: 'Evento inválido, falta información requerida',
          event
        });
        continue;
      }
      
      // Obtener o crear usuario
      let user;
      try {
        [user] = await db.User.findOrCreate({
          where: { email: event.user_email },
          defaults: {
            university_domain: event.user_email.split('@')[1],
            created_at: new Date(),
            last_active_at: new Date()
          }
        });
        
        // Actualizar última vez activo
        if (user) {
          user.last_active_at = new Date();
          await user.save();
        }
      } catch (error) {
        console.error('Error al procesar usuario:', error);
        results.push({ 
          status: 'error', 
          message: 'Error al procesar usuario',
          event 
        });
        continue;
      }

      // Cuando procesamos un evento CHAT_INTERACTION
if (event.event_type === 'CHAT_INTERACTION' && event.data) {
  try {
    await db.ChatInteraction.create({
      user_id: user.user_id,
      session_id: event.session_id,
      message_type: event.data.message_type || 'unknown',
      message_content: null, // Por privacidad no guardamos el contenido completo
      timestamp: new Date(event.timestamp),
      included_code: event.data.included_code === true,
      code_language: event.data.code_language || null,
      query_category: event.data.query_category || null,
      response_helpful: event.data.response_helpful || null
    });
    
    console.log('Chat interaction guardada correctamente en la tabla chat_interactions');
  } catch (error) {
    console.error('Error al guardar interacción de chat:', error);
    // No fallamos el evento completo si esto falla, solo lo registramos
  }
}
      
      // Procesar sesión si hay ID de sesión
      let session;
      if (event.session_id) {
        try {
          [session] = await db.Session.findOrCreate({
            where: { session_id: event.session_id },
            defaults: {
              user_id: user.user_id,
              start_time: new Date(event.timestamp),
              session_type: event.event_type.startsWith('PAIR_') ? 'pair_programming' : 'regular',
              platform_info: event.platform_info
            }
          });
        } catch (error) {
          console.error('Error al procesar sesión:', error);
        }
      }
      
      // Guardar el evento
      try {
        const savedEvent = await db.AnalyticsEvent.create({
          event_type: event.event_type,
          user_id: user.user_id,
          session_id: event.session_id,
          timestamp: new Date(event.timestamp),
          data: event.data || {}
        });
        
        results.push({ 
          status: 'success', 
          event_id: savedEvent.event_id 
        });
      } catch (error) {
        console.error('Error al guardar evento:', error);
        results.push({ 
          status: 'error', 
          message: 'Error al guardar evento',
          event 
        });
      }
    }
    
    const successCount = results.filter(r => r.status === 'success').length;
    
    return res.status(200).json({
      message: `${successCount} de ${events.length} eventos procesados correctamente`,
      results
    });
    
  } catch (error) {
    console.error('Error al procesar eventos:', error);
    return res.status(500).json({ error: 'Error del servidor al procesar eventos' });
  }
};

// Obtener resumen de analytics
exports.getSummary = async (req, res) => {
  try {
    // Contar usuarios únicos
    const userCount = await db.User.count();
    
    // Contar sesiones
    const sessionCount = await db.Session.count();
    
    // Contar eventos por tipo
    const eventTypeCount = await db.AnalyticsEvent.findAll({
      attributes: [
        'event_type',
        [db.sequelize.fn('COUNT', db.sequelize.col('event_type')), 'count']
      ],
      group: ['event_type'],
      order: [[db.sequelize.literal('count'), 'DESC']]
    });
    
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
      event_types: eventTypeCount,
      recent_activity: recentActivity
    });
    
  } catch (error) {
    console.error('Error al obtener resumen:', error);
    return res.status(500).json({ error: 'Error del servidor al obtener resumen' });
  }
};

// Obtener datos de actividad de usuario
exports.getUserActivity = async (req, res) => {
  try {
    const { email } = req.params;
    
    // Verificar que el email existe
    const user = await db.User.findOne({ where: { email } });
    if (!user) {
      return res.status(404).json({ error: 'Usuario no encontrado' });
    }
    
    // Obtener eventos del usuario
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
    
    return res.status(200).json({
      user: {
        email: user.email,
        university_domain: user.university_domain,
        created_at: user.created_at,
        last_active_at: user.last_active_at
      },
      events_by_type: eventsByType,
      recent_events: events
    });
    
  } catch (error) {
    console.error('Error al obtener actividad de usuario:', error);
    return res.status(500).json({ error: 'Error del servidor al obtener actividad de usuario' });
  }
};

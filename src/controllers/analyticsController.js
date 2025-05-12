const db = require('../models');
const { Op } = require('sequelize');

// Procesar eventos entrantes
exports.processEvents = async (req, res) => {
  try {
    const { events } = req.body;
    
    if (!Array.isArray(events) || events.length === 0) {
      return res.status(400).json({ error: 'Se requiere un array de eventos no vacío' });
    }
    
    console.log(`Procesando ${events.length} eventos`);
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
      
      console.log(`Procesando evento: ${event.event_type}`);
      
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
          // No fallamos todo el evento por esto, continuamos
        }
      }
      
      // Cuando procesamos un evento CHAT_INTERACTION
      if (event.event_type === 'CHAT_INTERACTION' && event.data) {
        try {
          await db.ChatInteraction.create({
            user_id: user.user_id,
            session_id: event.session_id,
            message_type: event.data.message_type || 'unknown',
            message_content: event.data.message_content || null,
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
      
      // Cuando procesamos un evento CODE_SNAPSHOT
      // When processing a CODE_SNAPSHOT event
if (event.event_type === 'CODE_SNAPSHOT') {
  try {
    // Debugging to see the structure of the event
    console.log('Processing CODE_SNAPSHOT event with data structure:', JSON.stringify(event).substring(0, 200) + '...');
    
    // Extract data properly from event structure
    const metadata = event.data && event.data.metadata ? event.data.metadata : {};
    const codeContent = event.data && event.data.code_content ? event.data.code_content : null;
    
    if (!codeContent) {
      console.log('CODE_SNAPSHOT sin contenido de código, omitiendo');
      results.push({ 
        status: 'error', 
        message: 'Falta el contenido del código',
        event_type: event.event_type
      });
      continue;
    }
    
    // Create the code snapshot with proper data mapping
    const codeSnapshot = await db.CodeSnapshot.create({
      user_id: user.user_id,
      session_id: event.session_id,
      file_name: metadata.file_name || 'unknown.txt',
      language: metadata.language || 'plaintext',
      file_path: metadata.file_path || '',
      code_content: codeContent,
      line_count: metadata.metrics && metadata.metrics.line_count ? metadata.metrics.line_count : 0,
      char_count: metadata.metrics && metadata.metrics.char_count ? metadata.metrics.char_count : 0,
      workspace_info: metadata.workspace || {},
      pair_session_info: metadata.pair_session || null,
      timestamp: new Date(event.timestamp)
    });
    
    console.log(`CODE_SNAPSHOT guardado correctamente: ${metadata.file_name}, ID: ${codeSnapshot.snapshot_id}`);
    
    results.push({ 
      status: 'success', 
      message: 'Instantánea de código guardada',
      snapshot_id: codeSnapshot.snapshot_id,
      event_type: event.event_type
    });
    
  } catch (error) {
    console.error('Error al guardar CODE_SNAPSHOT:', error);
    results.push({ 
      status: 'error', 
      message: `Error al guardar instantánea de código: ${error.message}`,
      event_type: event.event_type
    });
  }
}
      
      // Guardar el evento general en analytics_events
      try {
        const savedEvent = await db.AnalyticsEvent.create({
          event_type: event.event_type,
          user_id: user.user_id,
          session_id: event.session_id,
          timestamp: new Date(event.timestamp),
          data: event.data || {}
        });
        
        // Solo agregamos un resultado si no hay uno específico (como CODE_SNAPSHOT)
        if (!results.some(r => r.event_type === event.event_type)) {
          results.push({ 
            status: 'success', 
            event_id: savedEvent.event_id,
            event_type: event.event_type
          });
        }
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
    
    // Contar instantáneas de código
    const codeSnapshotCount = await db.CodeSnapshot.count();
    
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
      code_snapshot_count: codeSnapshotCount,
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
    
    // Obtener instantáneas de código (solo metadatos)
    const codeSnapshots = await db.CodeSnapshot.findAll({
      attributes: [
        'snapshot_id', 'file_name', 'language', 'line_count', 
        'char_count', 'timestamp'
      ],
      where: { user_id: user.user_id },
      order: [['timestamp', 'DESC']],
      limit: 20
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
      code_snapshots: codeSnapshots
    });
    
  } catch (error) {
    console.error('Error al obtener actividad de usuario:', error);
    return res.status(500).json({ error: 'Error del servidor al obtener actividad de usuario' });
  }
};
const jwt = require('jsonwebtoken');
require('dotenv').config();

exports.authenticate = (req, res, next) => {
console.log('⚠️ MIDDLEWARE JWT ACTIVATE EJECUTÁNDOSE ⚠️');
  try {
    // Obtener token
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ error: 'No autorizado: Token no proporcionado' });
    }
    
    const token = authHeader.split(' ')[1];
    if (!token) {
      return res.status(401).json({ error: 'No autorizado: Token no proporcionado' });
    }
    
    // Verificar token
    jwt.verify(token, process.env.JWT_SECRET, (err, decoded) => {
      if (err) {
        return res.status(401).json({ error: 'No autorizado: Token inválido' });
      }
      
      req.user = decoded;
      next();
    });
  } catch (error) {
    console.error('Error en autenticación:', error);
    return res.status(500).json({ error: 'Error del servidor en autenticación' });
  }
};

// Para desarrollo, puedes usar este middleware simplificado sin JWT
//exports.simplifiedAuth = (req, res, next) => {
//  const apiKey = req.headers['x-api-key'];
//console.log('API Key recibida:', apiKey);
//  console.log('API Key configurada:', process.env.API_KEY);
//  if (apiKey === process.env.API_KEY || process.env.NODE_ENV === 'development') {
//    next();
//  } else {
//    return res.status(401).json({ error: 'No autorizado: API Key inválida' });
//  }
//};

exports.simplifiedAuth = (req, res, next) => {
  console.log('Middleware simplifiedAuth activado - MODO DESARROLLO');
  next(); // Acepta cualquier solicitud sin validación
};

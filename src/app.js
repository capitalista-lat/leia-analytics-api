const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const routes = require('./routes');
const db = require('./models');
require('dotenv').config();

const app = express();

// Middleware
app.use(helmet());
app.use(cors());
app.use(express.json({ limit: '10mb' }));

// Rutas
app.use('/api', routes);

// Ruta de prueba
app.get('/', (req, res) => {
  res.json({ message: 'API de Learning Analytics para Leia Assistant' });
});

// Manejo de errores global
app.use((err, req, res, next) => {
  console.error('Error no controlado:', err);
  res.status(500).json({ error: 'Error interno del servidor' });
});

// Sincronizar base de datos y arrancar servidor
const PORT = process.env.PORT || 3000;

// Test de conexión a la base de datos
db.sequelize
  .authenticate()
  .then(() => {
    console.log('Conexión a la base de datos establecida correctamente.');
    app.listen(PORT, () => {
      console.log(`Servidor iniciado en puerto ${PORT}`);
    });
  })
  .catch((err) => {
    console.error('Error al conectar con la base de datos:', err);
  });

module.exports = app;

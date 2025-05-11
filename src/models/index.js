const { Sequelize, DataTypes } = require('sequelize');
require('dotenv').config();

const sequelize = new Sequelize(
  process.env.DB_NAME,
  process.env.DB_USER,
  process.env.DB_PASSWORD,
  {
    host: process.env.DB_HOST,
    dialect: 'postgres',
    logging: false,
    pool: {
      max: 10,
      min: 0,
      acquire: 30000,
      idle: 10000
    }
  }
);

// Definir modelos
const User = sequelize.define('User', {
  user_id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true
  },
  email: {
    type: DataTypes.STRING,
    allowNull: false,
    unique: true
  },
  university_domain: DataTypes.STRING,
  created_at: {
    type: DataTypes.DATE,
    defaultValue: Sequelize.NOW
  },
  last_active_at: DataTypes.DATE,
  settings_json: DataTypes.JSONB
}, {
  tableName: 'users',
  timestamps: false
});

const Session = sequelize.define('Session', {
  session_id: {
    type: DataTypes.STRING,
    primaryKey: true
  },
  user_id: DataTypes.INTEGER,
  start_time: {
    type: DataTypes.DATE,
    allowNull: false
  },
  end_time: DataTypes.DATE,
  session_type: DataTypes.STRING,
  device_info: DataTypes.JSONB,
  platform_info: DataTypes.JSONB
}, {
  tableName: 'sessions',
  timestamps: false
});

const AnalyticsEvent = sequelize.define('AnalyticsEvent', {
  event_id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true
  },
  event_type: {
    type: DataTypes.STRING,
    allowNull: false
  },
  user_id: DataTypes.INTEGER,
  session_id: DataTypes.STRING,
  timestamp: {
    type: DataTypes.DATE,
    allowNull: false
  },
  data: DataTypes.JSONB
}, {
  tableName: 'analytics_events',
  timestamps: false
});

// Modelo para la tabla chat_interactions ya existente
const ChatInteraction = sequelize.define('ChatInteraction', {
  interaction_id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true
  },
  user_id: DataTypes.INTEGER,
  session_id: DataTypes.STRING,
  message_type: {
    type: DataTypes.STRING,
    allowNull: false
  },
  message_content: DataTypes.TEXT,
  timestamp: {
    type: DataTypes.DATE,
    allowNull: false
  },
  included_code: {
    type: DataTypes.BOOLEAN,
    defaultValue: false
  },
  code_language: DataTypes.STRING,
  query_category: DataTypes.STRING,
  response_helpful: DataTypes.BOOLEAN
}, {
  tableName: 'chat_interactions',
  timestamps: false
});

// Establecer relaciones
Session.belongsTo(User, { foreignKey: 'user_id' });
AnalyticsEvent.belongsTo(User, { foreignKey: 'user_id' });
AnalyticsEvent.belongsTo(Session, { foreignKey: 'session_id' });

// Exportar modelos
const db = {
  sequelize,
  Sequelize,
  User,
  Session,
  AnalyticsEvent,
  ChatInteraction 
};

module.exports = db;

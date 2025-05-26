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

const CodeSnapshot = sequelize.define('CodeSnapshot', {
  snapshot_id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true
  },
  user_id: DataTypes.INTEGER,
  session_id: DataTypes.STRING,
  file_name: {
    type: DataTypes.STRING,
    allowNull: false
  },
  language: DataTypes.STRING,
  file_path: DataTypes.STRING,
  code_content: {
    type: DataTypes.TEXT,
    allowNull: false
  },
  line_count: DataTypes.INTEGER,
  char_count: DataTypes.INTEGER,
  workspace_info: DataTypes.JSONB,
  pair_session_info: DataTypes.JSONB,
  timestamp: {
    type: DataTypes.DATE,
    allowNull: false,
    defaultValue: Sequelize.NOW
  }
}, {
  tableName: 'code_snapshots',
  timestamps: false
});

const PairProgrammingSession = sequelize.define('PairProgrammingSession', {
  pp_session_id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true
  },
  session_id: {
    type: DataTypes.STRING,
    allowNull: false
  },
  driver_id: {
    type: DataTypes.INTEGER,
    allowNull: false
  },
  navigator_id: {
    type: DataTypes.INTEGER,
    allowNull: false
  },
  start_time: {
    type: DataTypes.DATE,
    allowNull: false
  },
  end_time: {
    type: DataTypes.DATE,
    allowNull: true
  },
  total_role_switches: {
    type: DataTypes.INTEGER,
    defaultValue: 0
  },
  completed_tasks_count: {
    type: DataTypes.INTEGER,
    defaultValue: 0
  },
  pending_tasks_count: {
    type: DataTypes.INTEGER,
    defaultValue: 0
  }
}, {
  tableName: 'pair_programming_sessions',
  timestamps: false
});

PairProgrammingSession.belongsTo(Session, { foreignKey: 'session_id' });
PairProgrammingSession.belongsTo(User, { as: 'Driver', foreignKey: 'driver_id' });
PairProgrammingSession.belongsTo(User, { as: 'Navigator', foreignKey: 'navigator_id' });


// Establecer relaciones
CodeSnapshot.belongsTo(User, { foreignKey: 'user_id' });
CodeSnapshot.belongsTo(Session, { foreignKey: 'session_id' });


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
  ChatInteraction,
  CodeSnapshot,
  PairProgrammingSession
};

module.exports = db;

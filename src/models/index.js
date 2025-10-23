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

// ==================== DEFINICIÓN DE MODELOS ====================

/**
 * Modelo User - Usuarios del sistema
 */
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
  university_domain: {
    type: DataTypes.STRING(100),
    allowNull: true
  },
  created_at: {
    type: DataTypes.DATE,
    defaultValue: Sequelize.NOW
  },
  last_active_at: {
    type: DataTypes.DATE,
    allowNull: true
  },
  settings_json: {
    type: DataTypes.JSONB,
    allowNull: true
  }
}, {
  tableName: 'users',
  timestamps: false
});

/**
 * Modelo Session - Sesiones de usuario
 */
const Session = sequelize.define('Session', {
  session_id: {
    type: DataTypes.STRING(255),
    primaryKey: true
  },
  user_id: {
    type: DataTypes.INTEGER,
    allowNull: true
  },
  start_time: {
    type: DataTypes.DATE,
    allowNull: false
  },
  end_time: {
    type: DataTypes.DATE,
    allowNull: true
  },
  session_type: {
    type: DataTypes.STRING(50),
    allowNull: true
  },
  device_info: {
    type: DataTypes.JSONB,
    allowNull: true
  },
  platform_info: {
    type: DataTypes.JSONB,
    allowNull: true
  },
  device_id: {
    type: DataTypes.STRING(255),
    allowNull: true
  }
}, {
  tableName: 'sessions',
  timestamps: false
});

/**
 * Modelo AnalyticsEvent - Eventos de analytics
 */
const AnalyticsEvent = sequelize.define('AnalyticsEvent', {
  event_id: {
    type: DataTypes.STRING(255),
    primaryKey: true
  },
  event_type: {
    type: DataTypes.STRING(100),
    allowNull: false
  },
  user_id: {
    type: DataTypes.INTEGER,
    allowNull: true
  },
  session_id: {
    type: DataTypes.STRING(255),
    allowNull: true
  },
  timestamp: {
    type: DataTypes.DATE,
    allowNull: false
  },
  data: {
    type: DataTypes.JSONB,
    defaultValue: {}
  },
  driver_user_id: {
    type: DataTypes.INTEGER,
    allowNull: true
  },
  navigator_user_id: {
    type: DataTypes.INTEGER,
    allowNull: true
  },
  conversation_id: {
    type: DataTypes.STRING(255),
    allowNull: true
  },
  pair_session_id: {
    type: DataTypes.STRING(255),
    allowNull: true
  }
}, {
  tableName: 'analytics_events',
  timestamps: false
});

/**
 * Modelo ChatInteraction - Interacciones de chat (tabla legacy)
 */
const ChatInteraction = sequelize.define('ChatInteraction', {
  interaction_id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true
  },
  session_id: {
    type: DataTypes.STRING(255),
    allowNull: true
  },
  user_id: {
    type: DataTypes.INTEGER,
    allowNull: true
  },
  message_type: {
    type: DataTypes.STRING(50),
    allowNull: false
  },
  message_content: {
    type: DataTypes.TEXT,
    allowNull: true
  },
  timestamp: {
    type: DataTypes.DATE,
    allowNull: false
  },
  included_code: {
    type: DataTypes.BOOLEAN,
    defaultValue: false
  },
  code_language: {
    type: DataTypes.STRING(50),
    allowNull: true
  },
  query_category: {
    type: DataTypes.STRING(100),
    allowNull: true
  },
  response_helpful: {
    type: DataTypes.BOOLEAN,
    allowNull: true
  },
  conversation_id: {
    type: DataTypes.STRING(255),
    allowNull: true
  },
  pair_session_id: {
    type: DataTypes.STRING(255),
    allowNull: true
  },
  message_id: {
    type: DataTypes.UUID,
    allowNull: true
  },
  author_role: {
    type: DataTypes.STRING(20),
    allowNull: true
  }
}, {
  tableName: 'chat_interactions',
  timestamps: false
});

/**
 * Modelo ChatMessage - Mensajes de chat individuales
 */
const ChatMessage = sequelize.define('ChatMessage', {
  message_id: {
    type: DataTypes.UUID,
    primaryKey: true,
    defaultValue: Sequelize.UUIDV4
  },
  conversation_id: {
    type: DataTypes.STRING(255),
    allowNull: false
  },
  pair_session_id: {
    type: DataTypes.STRING(255),
    allowNull: true
  },
  message_order: {
    type: DataTypes.INTEGER,
    allowNull: false
  },
  parent_message_id: {
    type: DataTypes.UUID,
    allowNull: true
  },
  author_user_id: {
    type: DataTypes.INTEGER,
    allowNull: true
  },
  author_role: {
    type: DataTypes.STRING(20),
    allowNull: true
  },
  driver_user_id: {
    type: DataTypes.INTEGER,
    allowNull: true
  },
  navigator_user_id: {
    type: DataTypes.INTEGER,
    allowNull: true
  },
  message_type: {
    type: DataTypes.STRING(50),
    allowNull: false
  },
  message_content: {
    type: DataTypes.TEXT,
    allowNull: false
  },
  message_length: {
    type: DataTypes.INTEGER,
    allowNull: true
  },
  included_code: {
    type: DataTypes.BOOLEAN,
    defaultValue: false
  },
  code_language: {
    type: DataTypes.STRING(50),
    allowNull: true
  },
  code_lines_count: {
    type: DataTypes.INTEGER,
    allowNull: true
  },
  query_category: {
    type: DataTypes.STRING(100),
    allowNull: true
  },
  response_time_ms: {
    type: DataTypes.INTEGER,
    allowNull: true
  },
  timestamp: {
    type: DataTypes.DATE,
    allowNull: false
  },
  created_at: {
    type: DataTypes.DATE,
    defaultValue: Sequelize.NOW
  }
}, {
  tableName: 'chat_messages',
  timestamps: false
});

/**
 * Modelo CodeSnapshot - Instantáneas de código
 */
const CodeSnapshot = sequelize.define('CodeSnapshot', {
  snapshot_id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true
  },
  user_id: {
    type: DataTypes.INTEGER,
    allowNull: true
  },
  session_id: {
    type: DataTypes.STRING(255),
    allowNull: true
  },
  file_name: {
    type: DataTypes.STRING(255),
    allowNull: false
  },
  language: {
    type: DataTypes.STRING(50),
    allowNull: true
  },
  file_path: {
    type: DataTypes.TEXT,
    allowNull: true
  },
  code_content: {
    type: DataTypes.TEXT,
    allowNull: false
  },
  line_count: {
    type: DataTypes.INTEGER,
    allowNull: true
  },
  char_count: {
    type: DataTypes.INTEGER,
    allowNull: true
  },
  workspace_info: {
    type: DataTypes.JSONB,
    allowNull: true
  },
  pair_session_info: {
    type: DataTypes.JSONB,
    allowNull: true
  },
  timestamp: {
    type: DataTypes.DATE,
    allowNull: false,
    defaultValue: Sequelize.NOW
  },
  snapshot_id_uuid: {
    type: DataTypes.UUID,
    defaultValue: Sequelize.UUIDV4
  },
  pair_session_id: {
    type: DataTypes.STRING(255),
    allowNull: true
  },
  author_user_id: {
    type: DataTypes.INTEGER,
    allowNull: true
  },
  author_role: {
    type: DataTypes.STRING(20),
    allowNull: true
  },
  driver_user_id: {
    type: DataTypes.INTEGER,
    allowNull: true
  },
  navigator_user_id: {
    type: DataTypes.INTEGER,
    allowNull: true
  },
  lines_added: {
    type: DataTypes.INTEGER,
    allowNull: true
  },
  chars_added: {
    type: DataTypes.INTEGER,
    allowNull: true
  },
  task_id: {
    type: DataTypes.STRING(255),
    allowNull: true
  },
  git_branch: {
    type: DataTypes.STRING(255),
    allowNull: true
  },
  git_commit: {
    type: DataTypes.STRING(255),
    allowNull: true
  },
  has_git_changes: {
    type: DataTypes.BOOLEAN,
    defaultValue: false
  },
  workspace_name: {
    type: DataTypes.STRING(255),
    allowNull: true
  }
}, {
  tableName: 'code_snapshots',
  timestamps: false
});

/**
 * Modelo PairProgrammingSession - Sesiones de pair programming
 */
const PairProgrammingSession = sequelize.define('PairProgrammingSession', {
  pp_session_id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true
  },
  session_id: {
    type: DataTypes.STRING(255),
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
  },
  pair_session_id: {
    type: DataTypes.STRING(255),
    unique: true,
    allowNull: true
  },
  current_driver_id: {
    type: DataTypes.INTEGER,
    allowNull: true
  },
  expected_duration_minutes: {
    type: DataTypes.INTEGER,
    defaultValue: 15
  },
  workspace_name: {
    type: DataTypes.STRING(255),
    allowNull: true
  }
}, {
  tableName: 'pair_programming_sessions',
  timestamps: false
});

/**
 * Modelo RoleSwitch - Cambios de rol en pair programming
 */
const RoleSwitch = sequelize.define('RoleSwitch', {
  switch_id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true
  },
  pp_session_id: {
    type: DataTypes.INTEGER,
    allowNull: false
  },
  timestamp: {
    type: DataTypes.DATE,
    allowNull: false
  },
  previous_driver: {
    type: DataTypes.INTEGER,
    allowNull: true
  },
  new_driver: {
    type: DataTypes.INTEGER,
    allowNull: true
  }
}, {
  tableName: 'role_switches',
  timestamps: false
});

/**
 * Modelo CodeAnalysis - Análisis de código
 */
const CodeAnalysis = sequelize.define('CodeAnalysis', {
  analysis_id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true
  },
  session_id: {
    type: DataTypes.STRING(255),
    allowNull: true
  },
  user_id: {
    type: DataTypes.INTEGER,
    allowNull: true
  },
  code_snippet: {
    type: DataTypes.TEXT,
    allowNull: true
  },
  language: {
    type: DataTypes.STRING(50),
    allowNull: true
  },
  character_count: {
    type: DataTypes.INTEGER,
    allowNull: true
  },
  line_count: {
    type: DataTypes.INTEGER,
    allowNull: true
  },
  contains_errors: {
    type: DataTypes.BOOLEAN,
    allowNull: true
  },
  complexity_score: {
    type: DataTypes.DOUBLE,
    allowNull: true
  },
  analyzed_at: {
    type: DataTypes.DATE,
    allowNull: false
  }
}, {
  tableName: 'code_analysis',
  timestamps: false
});

/**
 * Modelo FeatureUsage - Uso de features
 */
const FeatureUsage = sequelize.define('FeatureUsage', {
  usage_id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true
  },
  session_id: {
    type: DataTypes.STRING(255),
    allowNull: true
  },
  user_id: {
    type: DataTypes.INTEGER,
    allowNull: true
  },
  feature_name: {
    type: DataTypes.STRING(100),
    allowNull: false
  },
  timestamp: {
    type: DataTypes.DATE,
    allowNull: false
  },
  duration_seconds: {
    type: DataTypes.INTEGER,
    allowNull: true
  },
  result_status: {
    type: DataTypes.STRING(50),
    allowNull: true
  }
}, {
  tableName: 'feature_usage',
  timestamps: false
});

/**
 * Modelo PPTask - Tareas de pair programming
 */
const PPTask = sequelize.define('PPTask', {
  task_id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true  // ✅ Asegúrate que esté así
  },
  pp_session_id: {
    type: DataTypes.INTEGER,
    allowNull: true
  },
  description: {
    type: DataTypes.TEXT,
    allowNull: false
  },
  created_at: {
    type: DataTypes.DATE,
    allowNull: false
  },
  completed_at: {
    type: DataTypes.DATE,
    allowNull: true
  },
  completed_by_user_id: {
    type: DataTypes.INTEGER,
    allowNull: true
  }
}, {
  tableName: 'pp_tasks',
  timestamps: false
});

// ==================== RELACIONES ====================

// User relations
Session.belongsTo(User, { foreignKey: 'user_id', as: 'user' });
AnalyticsEvent.belongsTo(User, { foreignKey: 'user_id', as: 'user' });
AnalyticsEvent.belongsTo(User, { foreignKey: 'driver_user_id', as: 'driverUser' });
AnalyticsEvent.belongsTo(User, { foreignKey: 'navigator_user_id', as: 'navigatorUser' });

// Session relations
AnalyticsEvent.belongsTo(Session, { foreignKey: 'session_id', as: 'session' });
ChatInteraction.belongsTo(Session, { foreignKey: 'session_id', as: 'session' });
ChatInteraction.belongsTo(User, { foreignKey: 'user_id', as: 'user' });

// CodeSnapshot relations
CodeSnapshot.belongsTo(User, { foreignKey: 'user_id', as: 'user' });
CodeSnapshot.belongsTo(User, { foreignKey: 'author_user_id', as: 'author' });
CodeSnapshot.belongsTo(User, { foreignKey: 'driver_user_id', as: 'driver' });
CodeSnapshot.belongsTo(User, { foreignKey: 'navigator_user_id', as: 'navigator' });
CodeSnapshot.belongsTo(Session, { foreignKey: 'session_id', as: 'session' });

// PairProgrammingSession relations
PairProgrammingSession.belongsTo(Session, { foreignKey: 'session_id', as: 'session' });
PairProgrammingSession.belongsTo(User, { as: 'driver', foreignKey: 'driver_id' });
PairProgrammingSession.belongsTo(User, { as: 'navigator', foreignKey: 'navigator_id' });
PairProgrammingSession.belongsTo(User, { as: 'currentDriver', foreignKey: 'current_driver_id' });

// ChatMessage relations
ChatMessage.belongsTo(User, { foreignKey: 'author_user_id', as: 'author' });
ChatMessage.belongsTo(User, { foreignKey: 'driver_user_id', as: 'driver' });
ChatMessage.belongsTo(User, { foreignKey: 'navigator_user_id', as: 'navigator' });
ChatMessage.belongsTo(ChatMessage, { foreignKey: 'parent_message_id', as: 'parentMessage' });

// RoleSwitch relations
RoleSwitch.belongsTo(PairProgrammingSession, { foreignKey: 'pp_session_id', as: 'pairSession' });
RoleSwitch.belongsTo(User, { foreignKey: 'previous_driver', as: 'previousDriver' });
RoleSwitch.belongsTo(User, { foreignKey: 'new_driver', as: 'newDriver' });

// CodeAnalysis relations
CodeAnalysis.belongsTo(Session, { foreignKey: 'session_id', as: 'session' });
CodeAnalysis.belongsTo(User, { foreignKey: 'user_id', as: 'user' });

// FeatureUsage relations
FeatureUsage.belongsTo(Session, { foreignKey: 'session_id', as: 'session' });
FeatureUsage.belongsTo(User, { foreignKey: 'user_id', as: 'user' });

// PPTask relations
PPTask.belongsTo(PairProgrammingSession, { foreignKey: 'pp_session_id', as: 'pairSession' });
PPTask.belongsTo(User, { foreignKey: 'completed_by_user_id', as: 'completedBy' });

// ==================== EXPORTAR ====================

const db = {
  sequelize,
  Sequelize,
  User,
  Session,
  AnalyticsEvent,
  ChatInteraction,
  ChatMessage,
  CodeSnapshot,
  PairProgrammingSession,
  RoleSwitch,
  CodeAnalysis,
  FeatureUsage,
  PPTask
};

module.exports = db;

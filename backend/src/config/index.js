require('dotenv').config();

module.exports = {
  port: process.env.PORT || 5000,
  nodeEnv: process.env.NODE_ENV || 'development',
  mlServiceUrl: process.env.ML_SERVICE_URL || 'http://localhost:8000',
  databaseUrl: process.env.DATABASE_URL || 'postgresql://postgres:postgrespassword@localhost:5432/industrial_fire_db',
  corsOrigin: process.env.CORS_ORIGIN || 'http://localhost:5173'
};

const express = require('express');
const fs = require('fs');
const path = require('path');
const cors = require('cors');
const morgan = require('morgan');
const config = require('./config');
const apiRoutes = require('./routes');
const dataRepository = require('./repositories');
const firmsIngestionService = require('./services/firmsIngestionService');

const app = express();

// Global Middlewares
const allowedOrigins = config.corsOrigin ? config.corsOrigin.split(',').map((o) => o.trim()) : ['*'];
app.use(cors({
  origin: (origin, callback) => {
    if (!origin || allowedOrigins.includes('*') || allowedOrigins.includes(origin)) {
      callback(null, true);
    } else {
      callback(new Error(`Origin ${origin} not permitted by CORS policy`));
    }
  },
  credentials: true
}));
app.use(express.json());

if (config.nodeEnv !== 'test') {
  app.use(morgan('dev'));
}

// API Routes mounted on /api
app.use('/api', apiRoutes);

const frontendBuildPath = path.resolve(__dirname, '../public');
const frontendIndexPath = path.join(frontendBuildPath, 'index.html');
if (fs.existsSync(frontendIndexPath)) {
  app.use(express.static(frontendBuildPath));
  app.get('*', (req, res, next) => {
    if (req.path === '/api' || req.path.startsWith('/api/') || !req.accepts('html')) {
      return next();
    }
    res.sendFile(frontendIndexPath);
  });
}

// Root overview
app.get('/', (req, res) => {
  res.json({
    project: 'IndustrialFireAI Backend REST API',
    problemStatementId: '26162',
    organization: 'National Technical Research Organisation (NTRO)',
    version: '1.0.0',
    phase: 'Phase 3 - Node.js Express Data Layer',
    endpoints: {
      health: 'GET /api/health',
      events: 'GET /api/events',
      eventById: 'GET /api/events/:id',
      eventStats: 'GET /api/events/stats',
      eventGeoJson: 'GET /api/events/geojson',
      infrastructure: 'GET /api/infrastructure',
      modelInfo: 'GET /api/model-info',
      predict: 'POST /api/predict'
    }
  });
});

// 404 Handler
app.use((req, res) => {
  res.status(404).json({
    success: false,
    error: `Endpoint not found: ${req.method} ${req.originalUrl}`
  });
});

// Centralized Error Handling Middleware
app.use((err, req, res, next) => {
  const statusCode = err.statusCode || 500;
  const message = err.message || 'Internal Server Error';

  if (statusCode >= 500 && config.nodeEnv !== 'test') {
    console.error('[SERVER ERROR]', err);
  }

  res.status(statusCode).json({
    success: false,
    error: message,
    ...(config.nodeEnv === 'development' && statusCode >= 500 ? { stack: err.stack } : {})
  });
});

// Start server after initializing data repository
async function startServer() {
  try {
    await dataRepository.init();
    firmsIngestionService.startScheduledSync();
    const server = app.listen(config.port, () => {
      console.log(`[IndustrialFireAI Backend] Running on http://localhost:${config.port} [${config.nodeEnv}]`);
    });
    return { app, server };
  } catch (error) {
    console.error('[CRITICAL] Failed to initialize backend server:', error);
    process.exit(1);
  }
}

let serverInstance;
if (process.env.NODE_ENV !== 'test') {
  startServer().then((inst) => {
    serverInstance = inst.server;
  });
}

module.exports = { app, startServer };

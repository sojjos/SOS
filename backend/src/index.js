const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const http = require('http');
const path = require('path');
require('dotenv').config();

const { pool } = require('./config/database');
const { initWebSocket, getActiveConnections } = require('./services/websocket');

// Import des routes
const authRoutes = require('./routes/auth');
const usersRoutes = require('./routes/users');
const agenciesRoutes = require('./routes/agencies');
const ticketsRoutes = require('./routes/tickets');
const dashboardRoutes = require('./routes/dashboard');
const notificationsRoutes = require('./routes/notifications');
const adminRoutes = require('./routes/admin');
const uploadsRoutes = require('./routes/uploads');
const dynamicQuestionsRoutes = require('./routes/dynamic-questions');
const unionRoutes = require('./routes/union');
const accountRequestsRoutes = require('./routes/account-requests');
const exportsRoutes = require('./routes/exports');

const app = express();
const PORT = process.env.PORT || 3001;

// ====================================
// MIDDLEWARES GLOBAUX
// ====================================

// Sécurité
app.use(helmet({
  crossOriginResourcePolicy: { policy: "cross-origin" }
}));

// CORS
app.use(cors({
  origin: process.env.FRONTEND_URL || 'http://localhost:3000',
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));

// Rate limiting
const limiter = rateLimit({
  windowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS) || 15 * 60 * 1000,
  max: parseInt(process.env.RATE_LIMIT_MAX_REQUESTS) || 100,
  message: {
    error: 'Trop de requêtes, veuillez réessayer plus tard.'
  }
});
app.use('/api/', limiter);

// Parser JSON
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

// Servir les fichiers statiques (uploads)
app.use('/uploads', express.static(path.join(__dirname, '..', 'uploads')));

// Logger des requêtes
app.use((req, res, next) => {
  const start = Date.now();
  res.on('finish', () => {
    const duration = Date.now() - start;
    console.log(`${new Date().toISOString()} | ${req.method} ${req.path} | ${res.statusCode} | ${duration}ms`);
  });
  next();
});

// ====================================
// ROUTES API
// ====================================

app.use('/api/auth', authRoutes);
app.use('/api/users', usersRoutes);
app.use('/api/agencies', agenciesRoutes);
app.use('/api/tickets', ticketsRoutes);
app.use('/api/dashboard', dashboardRoutes);
app.use('/api/notifications', notificationsRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/uploads', uploadsRoutes);
app.use('/api/dynamic-questions', dynamicQuestionsRoutes);
app.use('/api/union', unionRoutes);
app.use('/api/account-requests', accountRequestsRoutes);
app.use('/api/exports', exportsRoutes);

// Route de santé
app.get('/api/health', async (req, res) => {
  try {
    await pool.query('SELECT 1');
    res.json({
      status: 'healthy',
      timestamp: new Date().toISOString(),
      database: 'connected',
      websocket_connections: getActiveConnections(),
      version: '1.0.0'
    });
  } catch (err) {
    res.status(500).json({
      status: 'unhealthy',
      timestamp: new Date().toISOString(),
      database: 'disconnected',
      error: err.message
    });
  }
});

// Route racine
app.get('/', (req, res) => {
  res.json({
    name: 'SOS API',
    version: '1.0.0',
    description: 'Short Operational Summary - API Backend',
    documentation: '/api/docs'
  });
});

// ====================================
// GESTION DES ERREURS
// ====================================

// 404
app.use((req, res) => {
  res.status(404).json({
    error: 'Route non trouvée',
    path: req.path
  });
});

// Erreurs globales
app.use((err, req, res, next) => {
  console.error('❌ Erreur:', err);

  if (err.name === 'UnauthorizedError') {
    return res.status(401).json({ error: 'Token invalide ou expiré' });
  }

  if (err.name === 'ValidationError') {
    return res.status(400).json({ error: err.message });
  }

  res.status(err.status || 500).json({
    error: process.env.NODE_ENV === 'production'
      ? 'Une erreur est survenue'
      : err.message
  });
});

// ====================================
// DÉMARRAGE DU SERVEUR
// ====================================

// Créer le serveur HTTP
const server = http.createServer(app);

// Initialiser WebSocket
const io = initWebSocket(server);

server.listen(PORT, () => {
  console.log('\n' + '='.repeat(50));
  console.log('🚀 SOS API Server');
  console.log('='.repeat(50));
  console.log(`📡 Port: ${PORT}`);
  console.log(`🌍 Environnement: ${process.env.NODE_ENV || 'development'}`);
  console.log(`🔗 URL: http://localhost:${PORT}`);
  console.log(`📋 API: http://localhost:${PORT}/api`);
  console.log(`🔌 WebSocket: ws://localhost:${PORT}`);
  console.log('='.repeat(50) + '\n');
});

// Gestion de l'arrêt propre
process.on('SIGTERM', () => {
  console.log('📴 Signal SIGTERM reçu, arrêt du serveur...');
  server.close(() => {
    pool.end(() => {
      console.log('👋 Serveur arrêté proprement');
      process.exit(0);
    });
  });
});

module.exports = app;

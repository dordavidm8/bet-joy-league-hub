/**
 * app.js – שרת Express הראשי
 *
 * נקודת הכניסה של ה-backend. מאתחל את שרת Express, Socket.io ל-real-time,
 * מגדיר middleware (Helmet, CORS, Morgan, JSON parser), מחבר את כל 17 ה-routers,
 * ומפעיל את Cron Jobs.
 *
 * יציאה: 4000 (PORT מ-env var)
 * WebSocket: Socket.io rooms לפי gameId לעדכוני ציון חיים
 */
require('dotenv').config();
const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');

const { errorHandler } = require('./middleware/errorHandler');
const { startCronJobs } = require('./jobs');

const authRoutes = require('./routes/auth');
const userRoutes = require('./routes/users');
const gameRoutes = require('./routes/games');
const betRoutes = require('./routes/bets');
const leagueRoutes = require('./routes/leagues');
const leaderboardRoutes = require('./routes/leaderboard');
const quizRoutes = require('./routes/quiz');
const adminModule = require('./routes/admin');
const adminRoutes = adminModule;
const opsRouter = adminModule.opsRouter;
const minigamesRoutes = require('./routes/minigames');
const advisorRoutes = require('./routes/advisor');
const notificationRoutes = require('./routes/notifications');
const feedRoutes = require('./routes/feed');
const whatsappRoutes = require('./routes/whatsapp');
const supportRoutes = require('./routes/support');

const app = express();
const server = http.createServer(app);

const io = new Server(server, {
  cors: { origin: process.env.FRONTEND_URL || '*', methods: ['GET', 'POST'] },
});
app.set('io', io);

app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      imgSrc: ["'self'", 'data:', 'https://firebasestorage.googleapis.com', 'https://a.espncdn.com', 'https://*.espncdn.com', 'https://lh3.googleusercontent.com', 'https://upload.wikimedia.org', 'https://*.wikimedia.org', 'https://flagcdn.com'],
      scriptSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'"],
    },
  },
  crossOriginResourcePolicy: { policy: 'cross-origin' },
}));
app.use(cors({ origin: process.env.FRONTEND_URL || '*' }));
app.use(morgan('dev'));
app.use(express.json({ limit: '10mb' }));

app.get('/health', (req, res) => {
  const admin = require('./config/firebase');
  const firebaseReady = admin.apps.length > 0;
  res.json({ status: 'ok', stub: process.env.STUB_MODE === 'true', firebase: firebaseReady, ts: new Date() });
});

app.use('/api/auth', authRoutes);
app.use('/api/users', userRoutes);
app.use('/api/games', gameRoutes);
app.use('/api/bets', betRoutes);
app.use('/api/leagues', leagueRoutes);
app.use('/api/leaderboard', leaderboardRoutes);
app.use('/api/quiz', quizRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/ops', opsRouter);
app.use('/api/minigames', minigamesRoutes);
app.use('/api/advisor', advisorRoutes);
app.use('/api/notifications', notificationRoutes);
app.use('/api/feed', feedRoutes);
app.use('/api/whatsapp', whatsappRoutes);
/* Removed V1 socialRoutes */
/* Removed /api/social */
app.use('/api/agents', require('./routes/agentsV2'));
app.use('/api/support', supportRoutes);

app.use(errorHandler);

io.on('connection', (socket) => {
  socket.on('join_game', (gameId) => socket.join(`game:${gameId}`));
  socket.on('leave_game', (gameId) => socket.leave(`game:${gameId}`));
});

const PORT = process.env.PORT || 4000;
server.listen(PORT, '0.0.0.0', () => {
  const mode = process.env.STUB_MODE === 'true' ? '🧪 STUB MODE' : '🚀 LIVE MODE';
  console.log(`Kickoff backend running on port ${PORT} — ${mode}`);
  startCronJobs(io);
});

server.on('error', (err) => console.error('Server error:', err));
module.exports = { app, io };

require('dotenv').config();
const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');

const { errorHandler } = require('./middleware/errorHandler');
const { startCronJobs } = require('./jobs');

// Routes
const authRoutes = require('./routes/auth');
const userRoutes = require('./routes/users');
const gameRoutes = require('./routes/games');
const betRoutes = require('./routes/bets');
const leagueRoutes = require('./routes/leagues');
const leaderboardRoutes = require('./routes/leaderboard');
const quizRoutes = require('./routes/quiz');
const adminRoutes = require('./routes/admin');

const app = express();
const server = http.createServer(app);

// Socket.io for real-time live betting
const io = new Server(server, {
  cors: {
    origin: process.env.FRONTEND_URL || '*',
    methods: ['GET', 'POST'],
  },
});

// Make io accessible in routes
app.set('io', io);

// Middleware
app.use(helmet());
app.use(cors({ origin: process.env.FRONTEND_URL || '*' }));
app.use(morgan('dev'));
app.use(express.json());

// Health check
app.get('/health', (req, res) => res.json({ status: 'ok', ts: new Date() }));

// Routes
app.use('/api/auth', authRoutes);
app.use('/api/users', userRoutes);
app.use('/api/games', gameRoutes);
app.use('/api/bets', betRoutes);
app.use('/api/leagues', leagueRoutes);
app.use('/api/leaderboard', leaderboardRoutes);
app.use('/api/quiz', quizRoutes);
app.use('/api/admin', adminRoutes);

// Global error handler
app.use(errorHandler);

// Socket.io — live score rooms
io.on('connection', (socket) => {
  socket.on('join_game', (gameId) => {
    socket.join(`game:${gameId}`);
  });
  socket.on('leave_game', (gameId) => {
    socket.leave(`game:${gameId}`);
  });
  socket.on('disconnect', () => { });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, async () => {
  console.log(`🚀 Kickoff backend running on port ${PORT}`);
  startCronJobs(io);

  // Initial sync on startup to ensure DB isn't empty on first deploy
  try {
    const { syncUpcomingFixtures } = require('./jobs/syncGames');
    console.log('🔄 Running initial fixtures sync...');
    await syncUpcomingFixtures();
    console.log('✅ Initial sync complete');
  } catch (err) {
    console.error('❌ Initial sync failed:', err.message);
  }
});

module.exports = { app, io };

import express from 'express';
import { createServer } from 'http';
import { Server } from 'socket.io';
import mongoose from 'mongoose';
import dotenv from 'dotenv';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import path from 'path';
import { fileURLToPath } from 'url';
import authRoutes from './routes/auth.js';
import { securityMiddlewares, globalLimiter } from './middleware/security.js';
import { socketAuth } from './middleware/socketAuth.js';
import { moderateMessage, clearStrikes } from './middleware/moderator.js';
import { handleChatMessage, clearGuestCount } from './controllers/aiController.js';

dotenv.config();

// ── Validate required environment variables ───────────────────────────────
const requiredEnv = ['GEMINI_API_KEY', 'MONGO_URI', 'JWT_SECRET'];
for (const key of requiredEnv) {
  if (!process.env[key]) {
    console.error(`❌ Missing required env variable: ${key}`);
    process.exit(1);
  }
}

// ── Resolve paths for ES modules ──────────────────────────────────────────
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const httpServer = createServer(app);

// ── CORS origins — supports both static-server dev and Express-served modes
const allowedOrigins = [
  process.env.FRONTEND_URL || 'http://localhost:5500',
  `http://localhost:${process.env.PORT || 3001}`,
];

function corsOrigin(origin, callback) {
  // Allow requests with no origin (same-origin, mobile apps, Postman)
  if (!origin || allowedOrigins.includes(origin)) {
    callback(null, true);
  } else {
    callback(new Error('Not allowed by CORS'));
  }
}

const io = new Server(httpServer, {
  cors: {
    origin: allowedOrigins,
    methods: ['GET', 'POST'],
    credentials: true,
  }
});

// ── Global Express middlewares ─────────────────────────────────────────────
app.use(...securityMiddlewares);
app.use(globalLimiter);
app.use(cors({ origin: corsOrigin, credentials: true }));
app.use(express.json({ limit: '10kb' }));
app.use(cookieParser());
app.use(express.static(path.join(__dirname, '..', 'frontend')));

// ── Routes ─────────────────────────────────────────────────────────────────
app.use('/api/auth', authRoutes);

app.get('/health', (req, res) => res.json({ status: 'ok' }));

// Catch-all for undefined routes
app.use((req, res, next) => res.status(404).json({ error: 'Route not found.' }));

// Global error handler — never expose raw errors to client
app.use((err, req, res, next) => {
  console.error(err);
  res.status(err.status || 500).json({ error: 'Internal server error.' });
});

// ── Socket.io ──────────────────────────────────────────────────────────────
io.use(socketAuth);

io.on('connection', (socket) => {
  console.log(`[${socket.userId ?? 'guest'}] connected: ${socket.id}`);

  socket.on('chat:message', async (data) => {
    // Moderation runs first — abusive input never reaches Gemini
    if (!moderateMessage(socket, data?.message)) return;

    try {
      await handleChatMessage(socket, data);
    } catch (err) {
      console.error(err);
      socket.emit('chat:error', {
        message: err.message.includes('429')
          ? 'Rate limit hit. Please wait a moment.'
          : 'Something went wrong.',
      });
    }
  });

  socket.on('disconnect', () => {
    clearStrikes(socket.id);
    clearGuestCount(socket.id);
    console.log(`[${socket.userId ?? 'guest'}] disconnected: ${socket.id}`);
  });
});

// ── DB + server ────────────────────────────────────────────────────────────
mongoose.connect(process.env.MONGO_URI)
  .then(() => {
    console.log('MongoDB connected');
    httpServer.listen(process.env.PORT || 3001, () =>
      console.log(`Server on http://localhost:${process.env.PORT || 3001}`)
    );
  })
  .catch((err) => {
    console.error('MongoDB connection failed:', err);
    process.exit(1);
  });
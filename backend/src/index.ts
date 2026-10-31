import express from 'express';
import http from 'http';
import { Server as SocketIOServer } from 'socket.io';
import cors from 'cors';
import helmet from 'helmet';
import cookieParser from 'cookie-parser';
import dotenv from 'dotenv';
import windowsRouter from './routes/windows.js';
import ticketsRouter from './routes/tickets.js';
import authRouter from './routes/auth.js';
import adminRouter from './routes/admin.js';
import studentRouter from './routes/student.js';
import prisma from './db/prisma.js';
import { verifySessionToken, SESSION_COOKIE_NAME } from './lib/auth.js';

dotenv.config();

const app = express();
const server = http.createServer(app);

const rawClientUrl = process.env.CLIENT_URL || 'http://localhost:5173';
const allowedOrigins = rawClientUrl
  .split(',')
  .map((s) => s.trim())
  .filter(Boolean);
const PORT = process.env.PORT || 5000;

const io = new SocketIOServer(server, {
  cors: {
    origin: allowedOrigins,
    methods: ['GET', 'POST'],
    credentials: true,
  },
  allowRequest: (req, callback) => {
    const origin = req.headers.origin;
    if (origin && !allowedOrigins.includes(origin)) {
      return callback('Origin not allowed by Socket.IO', false);
    }
    return callback(null, true);
  },
});

app.use(helmet());
app.use(cors({ origin: allowedOrigins, credentials: true }));
app.use(express.json());
app.use(cookieParser());

// Basic health check route
app.get('/api/health', (_req, res) => {
  res.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    service: 'Dawrak API',
  });
});

// Mount domain routes
app.use('/api/auth', authRouter);
app.use('/api/admin', adminRouter);
app.use('/api/student', studentRouter);
app.use('/api/windows', windowsRouter);
app.use('/api/tickets', ticketsRouter);

// 404 handler
app.use((_req, res) => {
  res.status(404).json({
    error: {
      code: 'NOT_FOUND',
      message: 'المسار المطلوب غير موجود',
    },
  });
});

// Global error handler
app.use((err: any, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  console.error('Unhandled application error:', err);
  res.status(500).json({
    error: {
      code: 'INTERNAL_SERVER_ERROR',
      message: 'حدث خطأ غير متوقع في الخادم',
    },
  });
});

function parseCookies(cookieHeader?: string): Record<string, string> {
  const list: Record<string, string> = {};
  if (!cookieHeader) return list;
  cookieHeader.split(';').forEach((cookie) => {
    const parts = cookie.split('=');
    const key = parts.shift()?.trim();
    if (key) {
      list[key] = decodeURIComponent(parts.join('=').trim());
    }
  });
  return list;
}

// Socket.IO authentication middleware
io.use(async (socket, next) => {
  try {
    const cookieHeader = socket.handshake.headers.cookie;
    const cookies = parseCookies(cookieHeader);
    const token = cookies[SESSION_COOKIE_NAME];

    if (token) {
      const payload = verifySessionToken(token);
      if (payload) {
        const user = await prisma.user.findUnique({
          where: { id: payload.userId },
          include: { windows: true },
        });
        if (user && user.isActive) {
          socket.data.user = user;
        }
      }
    }
    next();
  } catch (error) {
    console.error('Socket auth middleware error:', error);
    next();
  }
});

// Socket.IO window subscription
io.on('connection', (socket) => {
  socket.on('join:window', (windowId: string) => {
    const user = socket.data.user;

    // If authenticated staff member, check window assignment
    if (user && user.role === 'STAFF') {
      const hasAccess = user.windows?.some((w: any) => w.windowId === windowId);
      if (!hasAccess) {
        socket.emit('error', {
          code: 'FORBIDDEN',
          message: 'ليس لديك صلاحية الوصول إلى تحديثات هذا الشباك',
        });
        return;
      }
    }

    // Public students or Super Admin or authorized staff join room
    socket.join(`window:${windowId}`);
  });

  socket.on('leave:window', (windowId: string) => {
    socket.leave(`window:${windowId}`);
  });
});

// Export io instance for use in routes
export { io, app, server };

if (process.env.NODE_ENV !== 'test') {
  server.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
  });
}

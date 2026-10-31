import { Router, Request, Response } from 'express';
import { z } from 'zod';
import rateLimit from 'express-rate-limit';
import prisma from '../db/prisma.js';
import {
  hashPassword,
  verifyPassword,
  generateSessionToken,
  verifySessionToken,
  SESSION_COOKIE_NAME,
} from '../lib/auth.js';

const router = Router();

const loginSchema = z.object({
  email: z.string().trim().min(1, 'البريد الإلكتروني مطلوب'),
  password: z.string().min(8, 'كلمة المرور يجب ألا تقل عن 8 أحرف'),
});

const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 10,
  skip: (req) => process.env.NODE_ENV === 'test' && req.headers['x-skip-rate-limit'] === 'true',
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    error: {
      code: 'RATE_LIMIT_EXCEEDED',
      message: 'تم تجاوز عدد محاولات الدخول المسموح بها، يرجى المحاولة بعد 15 دقيقة',
    },
  },
});

const GENERIC_AUTH_ERROR = {
  error: {
    code: 'INVALID_CREDENTIALS',
    message: 'البريد الإلكتروني أو كلمة المرور غير صحيحة',
  },
};

/**
 * POST /api/auth/login
 */
router.post('/login', loginLimiter, async (req: Request, res: Response): Promise<void> => {
  const parseResult = loginSchema.safeParse(req.body);
  if (!parseResult.success) {
    res.status(400).json({
      error: {
        code: 'VALIDATION_ERROR',
        message: parseResult.error.issues[0]?.message || 'بيانات الدخول غير صحيحة',
      },
    });
    return;
  }

  const { email, password } = parseResult.data;
  const normalizedEmail = email.toLowerCase().trim();

  const user = await prisma.user.findUnique({
    where: { email: normalizedEmail },
    include: { windows: true },
  });

  if (!user) {
    res.status(401).json(GENERIC_AUTH_ERROR);
    return;
  }

  let isValidPassword = await verifyPassword(user.passwordHash, password);
  if (!isValidPassword && password.trim() !== password) {
    isValidPassword = await verifyPassword(user.passwordHash, password.trim());
  }

  if (!isValidPassword) {
    res.status(401).json(GENERIC_AUTH_ERROR);
    return;
  }

  if (!user.isActive) {
    res.status(403).json({
      error: {
        code: 'USER_INACTIVE',
        message: 'الحساب معطل، يرجى التواصل مع مسؤول النظام',
      },
    });
    return;
  }

  const token = generateSessionToken({
    userId: user.id,
    role: user.role,
  });

  const isProd = process.env.NODE_ENV === 'production';
  res.cookie(SESSION_COOKIE_NAME, token, {
    httpOnly: true,
    sameSite: 'lax',
    secure: isProd,
    maxAge: 12 * 60 * 60 * 1000, // 12 hours
  });

  res.json({
    user: {
      id: user.id,
      name: user.name,
      role: user.role,
      windowIds: user.windows.map((w) => w.windowId),
    },
  });
});

/**
 * POST /api/auth/logout
 */
router.post('/logout', (_req: Request, res: Response): void => {
  const isProd = process.env.NODE_ENV === 'production';
  res.clearCookie(SESSION_COOKIE_NAME, {
    httpOnly: true,
    sameSite: 'lax',
    secure: isProd,
  });
  res.json({ message: 'تم تسجيل الخروج بنجاح' });
});

/**
 * GET /api/auth/me
 */
router.get('/me', async (req: Request, res: Response): Promise<void> => {
  const token = req.cookies?.[SESSION_COOKIE_NAME];
  if (!token) {
    res.status(401).json({
      error: {
        code: 'UNAUTHORIZED',
        message: 'يرجى تسجيل الدخول أولاً',
      },
    });
    return;
  }

  const payload = verifySessionToken(token);
  if (!payload) {
    res.status(401).json({
      error: {
        code: 'UNAUTHORIZED',
        message: 'انتهت صلاحية الجلسة، يرجى تسجيل الدخول مجدداً',
      },
    });
    return;
  }

  const user = await prisma.user.findUnique({
    where: { id: payload.userId },
    include: { windows: true },
  });

  if (!user || !user.isActive) {
    res.status(401).json({
      error: {
        code: 'UNAUTHORIZED',
        message: 'الحساب غير متاح أو تم تعطيله',
      },
    });
    return;
  }

  res.json({
    id: user.id,
    name: user.name,
    role: user.role,
    windowIds: user.windows.map((w) => w.windowId),
  });
});

export default router;

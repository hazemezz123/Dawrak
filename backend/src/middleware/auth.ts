import { Request, Response, NextFunction } from 'express';
import prisma from '../db/prisma.js';
import { verifySessionToken, SESSION_COOKIE_NAME } from '../lib/auth.js';

export interface AuthenticatedUser {
  id: string;
  name: string;
  email: string;
  role: 'SUPER_ADMIN' | 'STAFF';
  isActive: boolean;
  windows?: { windowId: string }[];
}

declare global {
  namespace Express {
    interface Request {
      user?: AuthenticatedUser;
    }
  }
}

/**
 * Ensures user is authenticated via valid session cookie and active.
 */
export async function requireAuth(req: Request, res: Response, next: NextFunction): Promise<void> {
  const token = req.cookies?.[SESSION_COOKIE_NAME];
  if (!token) {
    res.status(401).json({
      error: {
        code: 'UNAUTHORIZED',
        message: 'يرجى تسجيل الدخول للوصول إلى هذا المورد',
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
        message: 'الحساب غير موجود أو تم تعطيله',
      },
    });
    return;
  }

  req.user = user;
  next();
}

/**
 * Requires the authenticated user to be SUPER_ADMIN.
 */
export function requireSuperAdmin(req: Request, res: Response, next: NextFunction): void {
  if (!req.user) {
    res.status(401).json({
      error: {
        code: 'UNAUTHORIZED',
        message: 'يرجى تسجيل الدخول أولاً',
      },
    });
    return;
  }

  if (req.user.role !== 'SUPER_ADMIN') {
    res.status(403).json({
      error: {
        code: 'FORBIDDEN',
        message: 'ليس لديك صلاحية للوصول إلى هذا المورد (خاص بمسؤول النظام)',
      },
    });
    return;
  }

  next();
}

/**
 * Verifies that the user has access to the target window.
 * SUPER_ADMIN always passes.
 * STAFF passes only if assigned to this window.
 */
export async function requireWindowAccess(req: Request, res: Response, next: NextFunction): Promise<void> {
  if (!req.user) {
    res.status(401).json({
      error: {
        code: 'UNAUTHORIZED',
        message: 'يرجى تسجيل الدخول أولاً',
      },
    });
    return;
  }

  if (req.user.role === 'SUPER_ADMIN') {
    next();
    return;
  }

  const rawWindowId = req.params.id || req.params.windowId;
  const windowId = (Array.isArray(rawWindowId) ? rawWindowId[0] : rawWindowId) as string;
  if (!windowId) {
    res.status(400).json({
      error: {
        code: 'BAD_REQUEST',
        message: 'معرف الشباك غير محدد',
      },
    });
    return;
  }

  const assignment = await prisma.windowStaff.findUnique({
    where: {
      windowId_userId: {
        windowId,
        userId: req.user.id,
      },
    },
  });

  if (!assignment) {
    res.status(403).json({
      error: {
        code: 'FORBIDDEN',
        message: 'ليس لديك صلاحية الوصول إلى هذا الشباك',
      },
    });
    return;
  }

  next();
}

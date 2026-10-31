import { Router, Request, Response } from 'express';
import { z } from 'zod';
import prisma from '../db/prisma.js';
import { requireAuth, requireSuperAdmin } from '../middleware/auth.js';
import { hashPassword } from '../lib/auth.js';

const router = Router();

// Protect all admin routes
router.use(requireAuth, requireSuperAdmin);

const windowSchema = z.object({
  name: z.string().trim().min(1, 'اسم الشباك مطلوب'),
  location: z.string().trim().min(1, 'موقع الشباك مطلوب'),
  isActive: z.boolean().optional().default(true),
});

const updateWindowSchema = z.object({
  name: z.string().trim().min(1).optional(),
  location: z.string().trim().min(1).optional(),
  isActive: z.boolean().optional(),
});

const createServiceSchema = z.object({
  name: z.string().trim().min(1, 'اسم الخدمة مطلوب'),
  isActive: z.boolean().optional().default(true),
});

const updateServiceSchema = z.object({
  name: z.string().trim().min(1).optional(),
  isActive: z.boolean().optional(),
});

const createUserSchema = z.object({
  name: z.string().trim().min(1, 'الاسم مطلوب'),
  email: z.string().trim().email('صيغة البريد الإلكتروني غير صالحة'),
  password: z.string().min(8, 'كلمة المرور يجب ألا تقل عن 8 أحرف'),
  role: z.enum(['SUPER_ADMIN', 'STAFF']).optional().default('STAFF'),
});

const updateUserSchema = z.object({
  name: z.string().trim().min(1).optional(),
  isActive: z.boolean().optional(),
  password: z.string().min(8, 'كلمة المرور يجب ألا تقل عن 8 أحرف').optional(),
});

const assignStaffSchema = z.object({
  userIds: z.array(z.string().uuid('معرف المستخدم غير صالح')),
});

/**
 * GET /api/admin/windows
 */
router.get('/windows', async (_req: Request, res: Response): Promise<void> => {
  const windows = await prisma.window.findMany({
    include: {
      services: {
        orderBy: { name: 'asc' },
      },
      staff: {
        include: {
          user: {
            select: {
              id: true,
              name: true,
              email: true,
              isActive: true,
            },
          },
        },
      },
    },
    orderBy: { createdAt: 'asc' },
  });

  res.json(windows);
});

/**
 * POST /api/admin/windows
 */
router.post('/windows', async (req: Request, res: Response): Promise<void> => {
  const parseResult = windowSchema.safeParse(req.body);
  if (!parseResult.success) {
    res.status(400).json({
      error: {
        code: 'VALIDATION_ERROR',
        message: parseResult.error.issues[0]?.message || 'بيانات الشباك غير صالحة',
      },
    });
    return;
  }

  const { name, location, isActive } = parseResult.data;
  const newWindow = await prisma.window.create({
    data: { name, location, isActive },
  });

  res.status(201).json(newWindow);
});

/**
 * PATCH /api/admin/windows/:id
 */
router.patch('/windows/:id', async (req: Request, res: Response): Promise<void> => {
  const parseResult = updateWindowSchema.safeParse(req.body);
  if (!parseResult.success) {
    res.status(400).json({
      error: {
        code: 'VALIDATION_ERROR',
        message: parseResult.error.issues[0]?.message || 'بيانات التحديث غير صالحة',
      },
    });
    return;
  }

  const id = (Array.isArray(req.params.id) ? req.params.id[0] : req.params.id) as string;
  const existing = await prisma.window.findUnique({ where: { id } });
  if (!existing) {
    res.status(404).json({
      error: {
        code: 'WINDOW_NOT_FOUND',
        message: 'الشباك غير موجود',
      },
    });
    return;
  }

  const updated = await prisma.window.update({
    where: { id },
    data: parseResult.data,
  });

  res.json(updated);
});

/**
 * POST /api/admin/windows/:id/services
 */
router.post('/windows/:id/services', async (req: Request, res: Response): Promise<void> => {
  const parseResult = createServiceSchema.safeParse(req.body);
  if (!parseResult.success) {
    res.status(400).json({
      error: {
        code: 'VALIDATION_ERROR',
        message: parseResult.error.issues[0]?.message || 'بيانات الخدمة غير صالحة',
      },
    });
    return;
  }

  const windowId = (Array.isArray(req.params.id) ? req.params.id[0] : req.params.id) as string;
  const window = await prisma.window.findUnique({ where: { id: windowId } });
  if (!window) {
    res.status(404).json({
      error: {
        code: 'WINDOW_NOT_FOUND',
        message: 'الشباك غير موجود',
      },
    });
    return;
  }

  const service = await prisma.service.create({
    data: {
      windowId,
      name: parseResult.data.name,
      isActive: parseResult.data.isActive,
    },
  });

  res.status(201).json(service);
});

/**
 * PATCH /api/admin/services/:id
 */
router.patch('/services/:id', async (req: Request, res: Response): Promise<void> => {
  const parseResult = updateServiceSchema.safeParse(req.body);
  if (!parseResult.success) {
    res.status(400).json({
      error: {
        code: 'VALIDATION_ERROR',
        message: parseResult.error.issues[0]?.message || 'بيانات الخدمة غير صالحة',
      },
    });
    return;
  }

  const id = (Array.isArray(req.params.id) ? req.params.id[0] : req.params.id) as string;
  const existing = await prisma.service.findUnique({ where: { id } });
  if (!existing) {
    res.status(404).json({
      error: {
        code: 'SERVICE_NOT_FOUND',
        message: 'الخدمة غير موجودة',
      },
    });
    return;
  }

  const updated = await prisma.service.update({
    where: { id },
    data: parseResult.data,
  });

  res.json(updated);
});

/**
 * GET /api/admin/users
 */
router.get('/users', async (_req: Request, res: Response): Promise<void> => {
  const users = await prisma.user.findMany({
    select: {
      id: true,
      name: true,
      email: true,
      role: true,
      isActive: true,
      createdAt: true,
      windows: {
        select: {
          windowId: true,
          window: {
            select: {
              name: true,
            },
          },
        },
      },
    },
    orderBy: { createdAt: 'desc' },
  });

  const formatted = users.map((u) => ({
    id: u.id,
    name: u.name,
    email: u.email,
    role: u.role,
    isActive: u.isActive,
    createdAt: u.createdAt,
    windowIds: u.windows.map((w) => w.windowId),
    assignedWindows: u.windows.map((w) => ({ id: w.windowId, name: w.window.name })),
  }));

  res.json(formatted);
});

/**
 * POST /api/admin/users
 */
router.post('/users', async (req: Request, res: Response): Promise<void> => {
  const parseResult = createUserSchema.safeParse(req.body);
  if (!parseResult.success) {
    res.status(400).json({
      error: {
        code: 'VALIDATION_ERROR',
        message: parseResult.error.issues[0]?.message || 'بيانات المستخدم غير صالحة',
      },
    });
    return;
  }

  const { name, email, password, role } = parseResult.data;
  const normalizedEmail = email.toLowerCase();

  const existing = await prisma.user.findUnique({
    where: { email: normalizedEmail },
  });
  if (existing) {
    res.status(409).json({
      error: {
        code: 'EMAIL_EXISTS',
        message: 'البريد الإلكتروني مسجل بالفعل لمستخدم آخر',
      },
    });
    return;
  }

  const passwordHash = await hashPassword(password);
  const user = await prisma.user.create({
    data: {
      name,
      email: normalizedEmail,
      passwordHash,
      role,
      isActive: true,
    },
    select: {
      id: true,
      name: true,
      email: true,
      role: true,
      isActive: true,
      createdAt: true,
    },
  });

  res.status(201).json(user);
});

/**
 * PATCH /api/admin/users/:id
 */
router.patch('/users/:id', async (req: Request, res: Response): Promise<void> => {
  const parseResult = updateUserSchema.safeParse(req.body);
  if (!parseResult.success) {
    res.status(400).json({
      error: {
        code: 'VALIDATION_ERROR',
        message: parseResult.error.issues[0]?.message || 'بيانات التحديث غير صالحة',
      },
    });
    return;
  }

  const id = (Array.isArray(req.params.id) ? req.params.id[0] : req.params.id) as string;
  const currentUser = req.user!;

  // Super admin cannot deactivate their own account
  if (currentUser.id === id && parseResult.data.isActive === false) {
    res.status(400).json({
      error: {
        code: 'CANNOT_DEACTIVATE_SELF',
        message: 'لا يمكنك تعطيل حسابك الخاص',
      },
    });
    return;
  }

  const targetUser = await prisma.user.findUnique({ where: { id } });
  if (!targetUser) {
    res.status(404).json({
      error: {
        code: 'USER_NOT_FOUND',
        message: 'المستخدم غير موجود',
      },
    });
    return;
  }

  const updateData: any = {};
  if (parseResult.data.name !== undefined) updateData.name = parseResult.data.name;
  if (parseResult.data.isActive !== undefined) updateData.isActive = parseResult.data.isActive;
  if (parseResult.data.password) {
    updateData.passwordHash = await hashPassword(parseResult.data.password);
  }

  const updatedUser = await prisma.user.update({
    where: { id },
    data: updateData,
    select: {
      id: true,
      name: true,
      email: true,
      role: true,
      isActive: true,
      createdAt: true,
    },
  });

  res.json(updatedUser);
});

/**
 * PUT /api/admin/windows/:id/staff
 * Replaces the full assignment in one atomic transaction
 */
router.put('/windows/:id/staff', async (req: Request, res: Response): Promise<void> => {
  const parseResult = assignStaffSchema.safeParse(req.body);
  if (!parseResult.success) {
    res.status(400).json({
      error: {
        code: 'VALIDATION_ERROR',
        message: parseResult.error.issues[0]?.message || 'قائمة المستخدمين غير صالحة',
      },
    });
    return;
  }

  const windowId = (Array.isArray(req.params.id) ? req.params.id[0] : req.params.id) as string;
  const { userIds } = parseResult.data;

  const window = await prisma.window.findUnique({ where: { id: windowId } });
  if (!window) {
    res.status(404).json({
      error: {
        code: 'WINDOW_NOT_FOUND',
        message: 'الشباك غير موجود',
      },
    });
    return;
  }

  // Atomic transaction
  await prisma.$transaction([
    prisma.windowStaff.deleteMany({
      where: { windowId },
    }),
    ...(userIds.length > 0
      ? [
          prisma.windowStaff.createMany({
            data: userIds.map((userId) => ({
              windowId,
              userId,
            })),
          }),
        ]
      : []),
  ]);

  res.json({
    message: 'تم تحديث طاقم عمل الشباك بنجاح',
    windowId,
    userIds,
  });
});

export default router;

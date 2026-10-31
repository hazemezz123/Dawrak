import { Router, Request, Response } from 'express';
import { z } from 'zod';
import prisma from '../db/prisma.js';
import { getCairoDate } from '../utils/date.js';
import { getQueueSnapshot, emitQueueUpdate } from '../services/queueService.js';
import { requireAuth, requireWindowAccess } from '../middleware/auth.js';

const router = Router();

const createTicketSchema = z.object({
  deviceId: z.string().uuid({ message: 'معرف الجهاز غير صالح' }),
  serviceId: z.string().uuid({ message: 'معرف الخدمة غير صالح' }),
});

const nextTicketSchema = z.object({
  currentTicketId: z.string().uuid({ message: 'معرف التذكرة الحالية غير صالح' }).optional(),
});

const skipTicketSchema = z.object({
  currentTicketId: z.string().uuid({ message: 'معرف التذكرة الحالية غير صالح' }),
});

/**
 * GET /api/windows/:id
 * Window details
 */
router.get('/:id', async (req: Request, res: Response): Promise<void> => {
  try {
    const windowId = req.params.id as string;
    const window = await prisma.window.findUnique({
      where: { id: windowId },
    });

    if (!window) {
      res.status(404).json({
        error: {
          code: 'WINDOW_NOT_FOUND',
          message: 'الشباك غير موجود',
        },
      });
      return;
    }

    res.json(window);
  } catch (error) {
    console.error('Error fetching window:', error);
    res.status(500).json({
      error: {
        code: 'INTERNAL_SERVER_ERROR',
        message: 'حدث خطأ في الخادم أثناء جلب بيانات الشباك',
      },
    });
  }
});

/**
 * GET /api/windows/:id/display
 * Public window display snapshot (read-only, no student data)
 */
router.get('/:id/display', async (req: Request, res: Response): Promise<void> => {
  try {
    const windowId = req.params.id as string;
    const window = await prisma.window.findUnique({
      where: { id: windowId },
      select: {
        id: true,
        name: true,
        location: true,
        isActive: true,
      },
    });

    if (!window) {
      res.status(404).json({
        error: {
          code: 'WINDOW_NOT_FOUND',
          message: 'الشباك غير موجود',
        },
      });
      return;
    }

    const date = getCairoDate();
    const called = await prisma.ticket.findFirst({
      where: {
        windowId,
        queueDate: date,
        status: 'called',
      },
      select: {
        id: true,
        number: true,
        calledAt: true,
        service: {
          select: {
            id: true,
            name: true,
          },
        },
      },
    });

    res.json({
      window,
      called: called || null,
    });
  } catch (error) {
    console.error('Error fetching window display data:', error);
    res.status(500).json({
      error: {
        code: 'INTERNAL_SERVER_ERROR',
        message: 'حدث خطأ في الخادم أثناء جلب بيانات شاشة العرض',
      },
    });
  }
});

/**
 * GET /api/windows/:id/services
 * Available active services for window
 */
router.get('/:id/services', async (req: Request, res: Response): Promise<void> => {
  try {
    const windowId = req.params.id as string;
    const window = await prisma.window.findUnique({
      where: { id: windowId },
      include: {
        services: {
          where: { isActive: true },
          orderBy: { name: 'asc' },
        },
      },
    });

    if (!window) {
      res.status(404).json({
        error: {
          code: 'WINDOW_NOT_FOUND',
          message: 'الشباك غير موجود',
        },
      });
      return;
    }

    res.json(window.services);
  } catch (error) {
    console.error('Error fetching services:', error);
    res.status(500).json({
      error: {
        code: 'INTERNAL_SERVER_ERROR',
        message: 'حدث خطأ في الخادم أثناء جلب الخدمات',
      },
    });
  }
});

/**
 * POST /api/windows/:id/tickets
 * Issue a new ticket for device and service
 */
router.post('/:id/tickets', async (req: Request, res: Response): Promise<void> => {
  try {
    const windowId = req.params.id as string;

    const parseResult = createTicketSchema.safeParse(req.body);
    if (!parseResult.success) {
      res.status(400).json({
        error: {
          code: 'INVALID_INPUT',
          message: parseResult.error.issues[0]?.message || 'بيانات الطلب غير صالحة',
        },
      });
      return;
    }

    const { deviceId, serviceId } = parseResult.data;

    const window = await prisma.window.findUnique({
      where: { id: windowId },
    });
    if (!window || !window.isActive) {
      res.status(404).json({
        error: {
          code: 'WINDOW_NOT_FOUND',
          message: 'الشباك غير موجود أو غير متاح حالياً',
        },
      });
      return;
    }

    const service = await prisma.service.findFirst({
      where: {
        id: serviceId,
        windowId,
        isActive: true,
      },
    });
    if (!service) {
      res.status(400).json({
        error: {
          code: 'SERVICE_NOT_FOUND',
          message: 'الخدمة المطلوبة غير صالحة أو غير تابعة لهذا الشباك',
        },
      });
      return;
    }

    const studentDevice = await prisma.studentDevice.findUnique({
      where: { deviceId },
      select: { studentId: true },
    });
    if (!studentDevice) {
      res.status(404).json({
        error: {
          code: 'STUDENT_NOT_REGISTERED',
          message: 'يرجى تسجيل بيانات الطالب أولاً قبل أخذ تذكرة.',
        },
      });
      return;
    }

    const studentId = studentDevice.studentId;

    const existingActive = await prisma.ticket.findFirst({
      where: {
        windowId,
        status: { in: ['waiting', 'called'] },
        OR: [{ deviceId }, { studentId }],
      },
    });
    if (existingActive) {
      res.status(409).json({
        error: {
          code: 'ACTIVE_TICKET_EXISTS',
          message: 'لديك تذكرة نشطة بالفعل في هذا الشباك',
        },
      });
      return;
    }

    const queueDate = getCairoDate();

    const ticket = await prisma.$transaction(async (tx) => {
      const dateStr = queueDate.toISOString().slice(0, 10);
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${`${windowId}:${dateStr}`}))`;

      const activeWithinTx = await tx.ticket.findFirst({
        where: {
          windowId,
          status: { in: ['waiting', 'called'] },
          OR: [{ deviceId }, { studentId }],
        },
      });
      if (activeWithinTx) {
        throw {
          status: 409,
          code: 'ACTIVE_TICKET_EXISTS',
          message: 'لديك تذكرة نشطة بالفعل في هذا الشباك',
        };
      }

      const lastTicket = await tx.ticket.findFirst({
        where: { windowId, queueDate },
        orderBy: { number: 'desc' },
        select: { number: true },
      });
      const nextNumber = (lastTicket?.number ?? 0) + 1;

      const maxSortTicket = await tx.ticket.findFirst({
        where: { windowId, queueDate },
        orderBy: { sortKey: 'desc' },
        select: { sortKey: true },
      });
      const nextSortKey = maxSortTicket ? Number(maxSortTicket.sortKey) + 1 : 1;

      return tx.ticket.create({
        data: {
          windowId,
          serviceId,
          deviceId,
          studentId,
          queueDate,
          number: nextNumber,
          status: 'waiting',
          sortKey: nextSortKey,
          skipCount: 0,
        },
        include: {
          service: {
            select: { id: true, name: true },
          },
        },
      });
    });

    await emitQueueUpdate(windowId, queueDate);

    const aheadCount = await prisma.ticket.count({
      where: {
        windowId,
        queueDate,
        status: 'waiting',
        sortKey: { lt: ticket.sortKey },
      },
    });

    res.status(201).json({
      id: ticket.id,
      number: ticket.number,
      status: ticket.status,
      sortKey: Number(ticket.sortKey),
      skipCount: ticket.skipCount,
      aheadCount,
      windowId: ticket.windowId,
      service: ticket.service,
      createdAt: ticket.createdAt,
    });
  } catch (error: any) {
    if (error?.code === 'P2002' || error?.status === 409) {
      res.status(409).json({
        error: {
          code: 'ACTIVE_TICKET_EXISTS',
          message: 'لديك تذكرة نشطة بالفعل في هذا الشباك',
        },
      });
      return;
    }

    console.error('Error creating ticket:', error);
    res.status(500).json({
      error: {
        code: 'INTERNAL_SERVER_ERROR',
        message: 'حدث خطأ في الخادم أثناء إصدار التذكرة',
      },
    });
  }
});

/**
 * GET /api/windows/:id/queue
 * Waiting list and called ticket for staff / displays
 */
router.get('/:id/queue', requireAuth, requireWindowAccess, async (req: Request, res: Response): Promise<void> => {
  try {
    const windowId = req.params.id as string;
    const window = await prisma.window.findUnique({
      where: { id: windowId },
    });

    if (!window) {
      res.status(404).json({
        error: {
          code: 'WINDOW_NOT_FOUND',
          message: 'الشباك غير موجود',
        },
      });
      return;
    }

    const snapshot = await getQueueSnapshot(windowId, undefined, true);
    res.json(snapshot);
  } catch (error) {
    console.error('Error getting queue snapshot:', error);
    res.status(500).json({
      error: {
        code: 'INTERNAL_SERVER_ERROR',
        message: 'حدث خطأ في الخادم أثناء جلب قائمة الانتظار',
      },
    });
  }
});

/**
 * POST /api/windows/:id/next
 * Serve current ticket (if any), then call next waiting ticket
 */
router.post('/:id/next', requireAuth, requireWindowAccess, async (req: Request, res: Response): Promise<void> => {
  try {
    const windowId = req.params.id as string;
    const queueDate = getCairoDate();

    // Validate body
    const parseResult = nextTicketSchema.safeParse(req.body);
    if (!parseResult.success) {
      res.status(400).json({
        error: {
          code: 'INVALID_INPUT',
          message: parseResult.error.issues[0]?.message || 'بيانات الطلب غير صالحة',
        },
      });
      return;
    }
    const { currentTicketId } = parseResult.data;

    const window = await prisma.window.findUnique({
      where: { id: windowId },
    });

    if (!window) {
      res.status(404).json({
        error: {
          code: 'WINDOW_NOT_FOUND',
          message: 'الشباك غير موجود',
        },
      });
      return;
    }

    // Atomic transaction: verify/serve current called ticket, then call next waiting ticket
    const calledTicket = await prisma.$transaction(async (tx) => {
      const dateStr = queueDate.toISOString().slice(0, 10);
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${`${windowId}:${dateStr}`}))`;

      // 1. Check currently called ticket
      const currentCalled = await tx.ticket.findFirst({
        where: {
          windowId,
          queueDate,
          status: 'called',
        },
      });

      if (currentCalled) {
        // If currentTicketId was provided, it must match current called ticket to avoid stale clicks
        if (currentTicketId && currentTicketId !== currentCalled.id) {
          throw {
            status: 409,
            code: 'STALE_TICKET',
            message: 'تم تحديث التذكرة المستدعاة بالفعل بواسطة موظف آخر',
          };
        }
        // Mark current called ticket as served
        await tx.ticket.update({
          where: { id: currentCalled.id },
          data: { status: 'served' },
        });
      }

      // 2. Call waiting ticket with lowest sort_key, tiebreaking by created_at
      const nextWaiting = await tx.ticket.findFirst({
        where: {
          windowId,
          queueDate,
          status: 'waiting',
        },
        orderBy: [
          { sortKey: 'asc' },
          { createdAt: 'asc' },
        ],
        include: {
          service: { select: { id: true, name: true } },
        },
      });

      if (!nextWaiting) {
        return null;
      }

      return tx.ticket.update({
        where: { id: nextWaiting.id },
        data: {
          status: 'called',
          calledAt: new Date(),
        },
        include: {
          service: { select: { id: true, name: true } },
        },
      });
    });

    await emitQueueUpdate(windowId, queueDate);

    if (!calledTicket) {
      res.json({ ticket: null });
      return;
    }

    res.json({
      ticket: {
        id: calledTicket.id,
        number: calledTicket.number,
        status: calledTicket.status,
        sortKey: Number(calledTicket.sortKey),
        skipCount: calledTicket.skipCount,
        calledAt: calledTicket.calledAt,
        service: calledTicket.service,
      },
    });
  } catch (error: any) {
    if (error?.status === 409) {
      res.status(409).json({
        error: {
          code: error.code || 'CONFLICT',
          message: error.message || 'تعارض في حالة التذكرة',
        },
      });
      return;
    }

    console.error('Error calling next ticket:', error);
    res.status(500).json({
      error: {
        code: 'INTERNAL_SERVER_ERROR',
        message: 'حدث خطأ في الخادم أثناء استدعاء التذكرة التالية',
      },
    });
  }
});

/**
 * POST /api/windows/:id/skip
 * Skip currently called ticket
 */
router.post('/:id/skip', requireAuth, requireWindowAccess, async (req: Request, res: Response): Promise<void> => {
  try {
    const windowId = req.params.id as string;
    const queueDate = getCairoDate();

    // Validate body
    const parseResult = skipTicketSchema.safeParse(req.body);
    if (!parseResult.success) {
      res.status(400).json({
        error: {
          code: 'INVALID_INPUT',
          message: parseResult.error.issues[0]?.message || 'بيانات الطلب غير صالحة',
        },
      });
      return;
    }
    const { currentTicketId } = parseResult.data;

    const window = await prisma.window.findUnique({
      where: { id: windowId },
    });

    if (!window) {
      res.status(404).json({
        error: {
          code: 'WINDOW_NOT_FOUND',
          message: 'الشباك غير موجود',
        },
      });
      return;
    }

    const updatedTicket = await prisma.$transaction(async (tx) => {
      const dateStr = queueDate.toISOString().slice(0, 10);
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${`${windowId}:${dateStr}`}))`;

      // Must be currently called ticket
      const calledTicket = await tx.ticket.findFirst({
        where: {
          windowId,
          queueDate,
          status: 'called',
        },
        include: {
          service: { select: { id: true, name: true } },
        },
      });

      if (!calledTicket) {
        throw {
          status: 409,
          code: 'NO_CALLED_TICKET',
          message: 'لا توجد تذكرة مستدعاة حالياً ليتم تخطيها',
        };
      }

      if (calledTicket.id !== currentTicketId) {
        throw {
          status: 409,
          code: 'STALE_TICKET',
          message: 'تم تحديث التذكرة المستدعاة بالفعل بواسطة موظف آخر',
        };
      }

      if (calledTicket.skipCount === 0) {
        // First skip: re-insert after the next 3 waiting tickets using midpoint
        const waitingTickets = await tx.ticket.findMany({
          where: {
            windowId,
            queueDate,
            status: 'waiting',
          },
          orderBy: [
            { sortKey: 'asc' },
            { createdAt: 'asc' },
          ],
          select: { id: true, sortKey: true },
        });

        let targetSortKey: number;

        if (waitingTickets.length >= 4) {
          // Both 3rd and 4th waiting neighbors exist: compute midpoint
          const k3 = Number(waitingTickets[2].sortKey);
          const k4 = Number(waitingTickets[3].sortKey);
          targetSortKey = k3 < k4 ? (k3 + k4) / 2 : k3 + 0.5;
        } else if (waitingTickets.length === 3) {
          // Exactly 3 waiting: insert after the 3rd
          targetSortKey = Number(waitingTickets[2].sortKey) + 1;
        } else if (waitingTickets.length > 0) {
          // Fewer than 3 waiting: insert after the last waiting ticket
          targetSortKey = Number(waitingTickets[waitingTickets.length - 1].sortKey) + 1;
        } else {
          // No waiting tickets: place after called ticket
          targetSortKey = Number(calledTicket.sortKey) + 1;
        }

        return tx.ticket.update({
          where: { id: calledTicket.id },
          data: {
            skipCount: 1,
            status: 'waiting',
            calledAt: null,
            sortKey: targetSortKey,
          },
          include: {
            service: { select: { id: true, name: true } },
          },
        });
      } else {
        // Second skip (skip_count was 1): cancel ticket
        return tx.ticket.update({
          where: { id: calledTicket.id },
          data: {
            skipCount: 2,
            status: 'cancelled',
            calledAt: null,
          },
          include: {
            service: { select: { id: true, name: true } },
          },
        });
      }
    });

    await emitQueueUpdate(windowId, queueDate);

    res.json({
      ticket: {
        id: updatedTicket.id,
        number: updatedTicket.number,
        status: updatedTicket.status,
        sortKey: Number(updatedTicket.sortKey),
        skipCount: updatedTicket.skipCount,
        calledAt: updatedTicket.calledAt,
        service: updatedTicket.service,
      },
    });
  } catch (error: any) {
    if (error?.status === 409) {
      res.status(409).json({
        error: {
          code: error.code || 'CONFLICT',
          message: error.message || 'تعارض في حالة التذكرة',
        },
      });
      return;
    }

    if (error?.status === 400) {
      res.status(400).json({
        error: {
          code: error.code || 'BAD_REQUEST',
          message: error.message || 'طلب غير صالح',
        },
      });
      return;
    }

    console.error('Error skipping ticket:', error);
    res.status(500).json({
      error: {
        code: 'INTERNAL_SERVER_ERROR',
        message: 'حدث خطأ في الخادم أثناء تخطي التذكرة',
      },
    });
  }
});

export default router;

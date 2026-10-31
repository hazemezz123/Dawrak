import { Router, Request, Response } from 'express';
import prisma from '../db/prisma.js';

const router = Router();

/**
 * GET /api/tickets/:id
 * Get ticket status, number, and count of people ahead
 */
router.get('/:id', async (req: Request, res: Response): Promise<void> => {
  try {
    const ticketId = req.params.id as string;

    const ticket = await prisma.ticket.findUnique({
      where: { id: ticketId },
      include: {
        service: {
          select: { id: true, name: true },
        },
        window: {
          select: { id: true, name: true, location: true },
        },
      },
    });

    if (!ticket) {
      res.status(404).json({
        error: {
          code: 'TICKET_NOT_FOUND',
          message: 'التذكرة غير موجودة',
        },
      });
      return;
    }

    let aheadCount = 0;
    if (ticket.status === 'waiting') {
      aheadCount = await prisma.ticket.count({
        where: {
          windowId: ticket.windowId,
          queueDate: ticket.queueDate,
          status: 'waiting',
          OR: [
            { sortKey: { lt: ticket.sortKey } },
            {
              sortKey: ticket.sortKey,
              createdAt: { lt: ticket.createdAt },
            },
          ],
        },
      });
    }

    res.json({
      id: ticket.id,
      number: ticket.number,
      status: ticket.status,
      sortKey: Number(ticket.sortKey),
      skipCount: ticket.skipCount,
      aheadCount,
      windowId: ticket.windowId,
      windowName: ticket.window.name,
      windowLocation: ticket.window.location,
      service: ticket.service,
      createdAt: ticket.createdAt,
      calledAt: ticket.calledAt,
    });
  } catch (error) {
    console.error('Error fetching ticket status:', error);
    res.status(500).json({
      error: {
        code: 'INTERNAL_SERVER_ERROR',
        message: 'حدث خطأ في الخادم أثناء جلب بيانات التذكرة',
      },
    });
  }
});

export default router;

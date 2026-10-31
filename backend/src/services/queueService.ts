import prisma from '../db/prisma.js';
import { io } from '../index.js';
import { getCairoDate } from '../utils/date.js';

export async function getQueueSnapshot(
  windowId: string,
  queueDate?: Date,
  includeStudent = false
) {
  const date = queueDate || getCairoDate();

  const [called, waiting] = await Promise.all([
    prisma.ticket.findFirst({
      where: {
        windowId,
        queueDate: date,
        status: 'called',
      },
      include: {
        service: {
          select: { id: true, name: true },
        },
        student: {
          select: { id: true, fullName: true, phone: true },
        },
      },
    }),
    prisma.ticket.findMany({
      where: {
        windowId,
        queueDate: date,
        status: 'waiting',
      },
      orderBy: [
        { sortKey: 'asc' },
        { createdAt: 'asc' },
      ],
      include: {
        service: {
          select: { id: true, name: true },
        },
        student: {
          select: { id: true, fullName: true, phone: true },
        },
      },
    }),
  ]);

  return {
    windowId,
    date: date.toISOString().slice(0, 10),
    called: called
      ? {
          id: called.id,
          number: called.number,
          status: called.status,
          sortKey: Number(called.sortKey),
          skipCount: called.skipCount,
          calledAt: called.calledAt,
          service: called.service,
          ...(includeStudent ? { student: called.student } : {}),
        }
      : null,
    waiting: waiting.map((t) => ({
      id: t.id,
      number: t.number,
      status: t.status,
      sortKey: Number(t.sortKey),
      skipCount: t.skipCount,
      createdAt: t.createdAt,
      service: t.service,
      ...(includeStudent ? { student: t.student } : {}),
    })),
    waitingCount: waiting.length,
  };
}

export async function emitQueueUpdate(windowId: string, queueDate?: Date) {
  try {
    const snapshot = await getQueueSnapshot(windowId, queueDate);
    io.to(`window:${windowId}`).emit('queue:update', snapshot);
  } catch (error) {
    console.error(`Failed to emit queue update for window ${windowId}:`, error);
  }
}

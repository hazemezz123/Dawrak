import { Router, Request, Response } from 'express';
import { Prisma } from '@prisma/client';
import { z } from 'zod';
import prisma from '../db/prisma.js';
import { normalizePhone } from '../utils/phone.js';

const router = Router();

const PHONE_NAME_MISMATCH_MESSAGE =
  'البيانات دي مش مطابقة لسجل موجود، تأكد من الاسم والرقم أو كلم شؤون الطلاب.';
const DEVICE_ALREADY_LINKED_MESSAGE =
  'هذا الجهاز مرتبط ببيانات طالب آخر، يرجى التواصل مع شؤون الطلاب.';

const deviceIdSchema = z.string().uuid({ message: 'معرف الجهاز غير صالح' });

const getStudentSchema = z.object({
  device_id: deviceIdSchema,
});

const registerStudentSchema = z.object({
  deviceId: deviceIdSchema,
  fullName: z
    .string()
    .transform((value) => value.trim().replace(/\s+/g, ' '))
    .refine((value) => value.length >= 2 && value.length <= 80, {
      message: 'يرجى إدخال الاسم بالكامل (من حرفين إلى 80 حرفًا).',
    }),
  phone: z
    .string()
    .refine((value) => normalizePhone(value) !== null, {
      message: 'رقم الموبايل غير صالح، يجب أن يكون رقمًا مصريًا مكونًا من 11 رقمًا يبدأ بـ 01.',
    })
    .transform((value) => normalizePhone(value) as string),
});

interface RegistrationInput {
  deviceId: string;
  fullName: string;
  phone: string;
}

interface StudentRecord {
  id: string;
  fullName: string;
  phone: string;
}

function studentResponse(student: StudentRecord) {
  return {
    id: student.id,
    fullName: student.fullName,
    phone: student.phone,
  };
}

function conflict(status: number, code: string, message: string) {
  return { status, code, message };
}

function normalizeFullName(value: string): string {
  return value.trim().replace(/\s+/g, ' ');
}

async function resolveRegistration(
  tx: Prisma.TransactionClient,
  input: RegistrationInput
) {
  const [deviceLink, phoneStudent] = await Promise.all([
    tx.studentDevice.findUnique({
      where: { deviceId: input.deviceId },
      include: { student: true },
    }),
    tx.student.findUnique({ where: { phone: input.phone } }),
  ]);

  if (deviceLink) {
    if (!phoneStudent || phoneStudent.id !== deviceLink.studentId) {
      throw conflict(409, 'DEVICE_ALREADY_LINKED', DEVICE_ALREADY_LINKED_MESSAGE);
    }

    if (normalizeFullName(phoneStudent.fullName) !== input.fullName) {
      throw conflict(409, 'PHONE_NAME_MISMATCH', PHONE_NAME_MISMATCH_MESSAGE);
    }

    return phoneStudent;
  }

  if (phoneStudent) {
    if (normalizeFullName(phoneStudent.fullName) !== input.fullName) {
      throw conflict(409, 'PHONE_NAME_MISMATCH', PHONE_NAME_MISMATCH_MESSAGE);
    }

    await tx.studentDevice.create({
      data: {
        deviceId: input.deviceId,
        studentId: phoneStudent.id,
      },
    });
    return phoneStudent;
  }

  const student = await tx.student.create({
    data: {
      fullName: input.fullName,
      phone: input.phone,
    },
  });

  await tx.studentDevice.create({
    data: {
      deviceId: input.deviceId,
      studentId: student.id,
    },
  });

  return student;
}

async function registerStudent(input: RegistrationInput) {
  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      return await prisma.$transaction((tx) => resolveRegistration(tx, input));
    } catch (error: any) {
      if (error?.code === 'P2002' && attempt === 0) {
        continue;
      }
      throw error;
    }
  }

  throw new Error('UNREACHABLE_REGISTRATION_RETRY');
}

/**
 * GET /api/student/me?device_id=<uuid>
 * Resolve the student linked to a device.
 */
router.get('/me', async (req: Request, res: Response): Promise<void> => {
  const parseResult = getStudentSchema.safeParse(req.query);
  if (!parseResult.success) {
    res.status(400).json({
      error: {
        code: 'INVALID_INPUT',
        message: parseResult.error.issues[0]?.message || 'بيانات الطلب غير صالحة',
      },
    });
    return;
  }

  try {
    const link = await prisma.studentDevice.findUnique({
      where: { deviceId: parseResult.data.device_id },
      include: { student: true },
    });

    if (!link) {
      res.status(404).json({
        error: {
          code: 'STUDENT_NOT_REGISTERED',
          message: 'لم يتم تسجيل بيانات الطالب على هذا الجهاز.',
        },
      });
      return;
    }

    res.json(studentResponse(link.student));
  } catch (error: any) {
    console.error('Error fetching student identity:', error?.code || 'UNKNOWN');
    res.status(500).json({
      error: {
        code: 'INTERNAL_SERVER_ERROR',
        message: 'حدث خطأ في الخادم أثناء جلب بيانات الطالب',
      },
    });
  }
});

/**
 * POST /api/student/register
 * Create a student or link a new device to an existing student.
 */
router.post('/register', async (req: Request, res: Response): Promise<void> => {
  const parseResult = registerStudentSchema.safeParse(req.body);
  if (!parseResult.success) {
    res.status(400).json({
      error: {
        code: 'INVALID_INPUT',
        message: parseResult.error.issues[0]?.message || 'بيانات الطلب غير صالحة',
      },
    });
    return;
  }

  try {
    const student = await registerStudent(parseResult.data);
    res.json(studentResponse(student));
  } catch (error: any) {
    if (error?.status && error?.code) {
      res.status(error.status).json({
        error: {
          code: error.code,
          message: error.message,
        },
      });
      return;
    }

    if (error?.code === 'P2002') {
      res.status(409).json({
        error: {
          code: 'REGISTRATION_CONFLICT',
          message: 'تعذر إتمام التسجيل بسبب تعارض في البيانات، يرجى المحاولة مرة أخرى.',
        },
      });
      return;
    }

    console.error('Error registering student:', error?.code || 'UNKNOWN');
    res.status(500).json({
      error: {
        code: 'INTERNAL_SERVER_ERROR',
        message: 'حدث خطأ في الخادم أثناء تسجيل بيانات الطالب',
      },
    });
  }
});

export default router;

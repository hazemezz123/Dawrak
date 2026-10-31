import { PrismaClient } from '@prisma/client';
import dotenv from 'dotenv';
import argon2 from 'argon2';

dotenv.config();

const prisma = new PrismaClient();

async function main() {
  // Super Admin bootstrap
  const superAdminEmail = process.env.SUPER_ADMIN_EMAIL?.trim().toLowerCase();
  const superAdminPassword = process.env.SUPER_ADMIN_PASSWORD;

  if (superAdminEmail && superAdminPassword) {
    const existingAdmin = await prisma.user.findUnique({
      where: { email: superAdminEmail },
    });

    if (!existingAdmin) {
      const passwordHash = await argon2.hash(superAdminPassword);
      await prisma.user.create({
        data: {
          email: superAdminEmail,
          name: 'مسؤول النظام',
          passwordHash,
          role: 'SUPER_ADMIN',
          isActive: true,
        },
      });
      console.log(`Created Super Admin user: ${superAdminEmail}`);
    } else {
      console.log(`Super Admin user already exists: ${superAdminEmail}`);
    }
  } else {
    console.log('Skipping Super Admin seed: SUPER_ADMIN_EMAIL or SUPER_ADMIN_PASSWORD not set.');
  }

  // Window 1: شؤون الطلاب
  const window1Id = '00000000-0000-4000-8000-000000000001';
  await prisma.window.upsert({
    where: { id: window1Id },
    update: {
      name: 'شؤون الطلاب',
      location: 'المبنى الرئيسي - الدور الأول',
      isActive: true,
    },
    create: {
      id: window1Id,
      name: 'شؤون الطلاب',
      location: 'المبنى الرئيسي - الدور الأول',
      isActive: true,
    },
  });

  const window1Services = [
    {
      id: '00000000-0000-4000-8000-000000000101',
      name: 'استخراج إفادة',
      isActive: true,
    },
    {
      id: '00000000-0000-4000-8000-000000000102',
      name: 'طباعة استمارة السمر كورس',
      isActive: true,
    },
  ];

  for (const service of window1Services) {
    await prisma.service.upsert({
      where: { id: service.id },
      update: {
        name: service.name,
        isActive: service.isActive,
        windowId: window1Id,
      },
      create: {
        id: service.id,
        name: service.name,
        isActive: service.isActive,
        windowId: window1Id,
      },
    });
  }

  // Window 2: الحسابات والمصروفات
  const window2Id = '00000000-0000-4000-8000-000000000002';
  await prisma.window.upsert({
    where: { id: window2Id },
    update: {
      name: 'الحسابات والمصروفات',
      location: 'المبنى الرئيسي - الدور الأول',
      isActive: true,
    },
    create: {
      id: window2Id,
      name: 'الحسابات والمصروفات',
      location: 'المبنى الرئيسي - الدور الأول',
      isActive: true,
    },
  });

  const window2Services = [
    {
      id: '00000000-0000-4000-8000-000000000201',
      name: 'دفع المصروفات',
      isActive: true,
    },
    {
      id: '00000000-0000-4000-8000-000000000202',
      name: 'استخراج كارنيه بدل فاقد',
      isActive: true,
    },
  ];

  for (const service of window2Services) {
    await prisma.service.upsert({
      where: { id: service.id },
      update: {
        name: service.name,
        isActive: service.isActive,
        windowId: window2Id,
      },
      create: {
        id: service.id,
        name: service.name,
        isActive: service.isActive,
        windowId: window2Id,
      },
    });
  }

  console.log('Seed completed successfully.');
}

main()
  .catch((e) => {
    console.error('Seed failed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

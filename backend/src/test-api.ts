process.env.NODE_ENV = 'test';

import prisma from './db/prisma.js';
import { randomUUID } from 'crypto';
import argon2 from 'argon2';
import { io as ioc } from 'socket.io-client';
import { generateSessionToken, SESSION_COOKIE_NAME } from './lib/auth.js';
import { getCairoDate } from './utils/date.js';

const TEST_PORT = 5099;
const BASE_URL = `http://localhost:${TEST_PORT}/api`;

const WINDOW_1_ID = '00000000-0000-4000-8000-000000000001';
const WINDOW_2_ID = '00000000-0000-4000-8000-000000000002';
const SERVICE_1_ID = '00000000-0000-4000-8000-000000000101';

const TEST_STUDENT_PHONE_PREFIX = '0109999';
const testStudentPhone = (suffix: number) =>
  `${TEST_STUDENT_PHONE_PREFIX}${String(suffix).padStart(4, '0')}`;

function registerTestStudent(deviceId: string, fullName: string, phone: string) {
  return fetch(`${BASE_URL}/student/register`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ deviceId, fullName, phone }),
  });
}

async function runTests() {
  console.log('--- STARTING COMPREHENSIVE DAWRAK API TESTS ---');

  const { server } = await import('./index.js');

  await new Promise<void>((resolve) => {
    server.listen(TEST_PORT, () => {
      console.log(`Test server running on port ${TEST_PORT}`);
      resolve();
    });
  });

  // Clean slate before testing
  await prisma.ticket.deleteMany({
    where: { windowId: WINDOW_1_ID },
  });
  await prisma.student.deleteMany({
    where: { phone: { startsWith: TEST_STUDENT_PHONE_PREFIX } },
  });

  // Setup test users
  const superAdminId = '00000000-0000-4000-8000-000000000888';
  const staff1Id = '00000000-0000-4000-8000-000000000991';
  const staff2Id = '00000000-0000-4000-8000-000000000992';
  const inactiveUserId = '00000000-0000-4000-8000-000000000993';

  const defaultPassword = 'Password123!';
  const defaultHash = await argon2.hash(defaultPassword);

  // Super Admin
  await prisma.user.upsert({
    where: { email: 'test_admin@dawrak.faculty.edu' },
    update: { isActive: true, passwordHash: defaultHash, role: 'SUPER_ADMIN' },
    create: {
      id: superAdminId,
      name: 'Test Super Admin',
      email: 'test_admin@dawrak.faculty.edu',
      passwordHash: defaultHash,
      role: 'SUPER_ADMIN',
      isActive: true,
    },
  });

  // Staff 1 (Assigned to Window 1)
  await prisma.user.upsert({
    where: { email: 'test_staff1@dawrak.faculty.edu' },
    update: { isActive: true, passwordHash: defaultHash, role: 'STAFF' },
    create: {
      id: staff1Id,
      name: 'Staff Window 1',
      email: 'test_staff1@dawrak.faculty.edu',
      passwordHash: defaultHash,
      role: 'STAFF',
      isActive: true,
    },
  });
  await prisma.windowStaff.upsert({
    where: { windowId_userId: { windowId: WINDOW_1_ID, userId: staff1Id } },
    update: {},
    create: { windowId: WINDOW_1_ID, userId: staff1Id },
  });

  // Staff 2 (Assigned to Window 2 ONLY)
  await prisma.user.upsert({
    where: { email: 'test_staff2@dawrak.faculty.edu' },
    update: { isActive: true, passwordHash: defaultHash, role: 'STAFF' },
    create: {
      id: staff2Id,
      name: 'Staff Window 2',
      email: 'test_staff2@dawrak.faculty.edu',
      passwordHash: defaultHash,
      role: 'STAFF',
      isActive: true,
    },
  });
  await prisma.windowStaff.deleteMany({
    where: { windowId: WINDOW_1_ID, userId: staff2Id },
  });
  await prisma.windowStaff.upsert({
    where: { windowId_userId: { windowId: WINDOW_2_ID, userId: staff2Id } },
    update: {},
    create: { windowId: WINDOW_2_ID, userId: staff2Id },
  });

  // Inactive User
  await prisma.user.upsert({
    where: { email: 'test_inactive@dawrak.faculty.edu' },
    update: { isActive: false, passwordHash: defaultHash, role: 'STAFF' },
    create: {
      id: inactiveUserId,
      name: 'Inactive User',
      email: 'test_inactive@dawrak.faculty.edu',
      passwordHash: defaultHash,
      role: 'STAFF',
      isActive: false,
    },
  });

  const staff1Token = generateSessionToken({ userId: staff1Id, role: 'STAFF' });
  const staff1Headers = {
    'Content-Type': 'application/json',
    Cookie: `${SESSION_COOKIE_NAME}=${staff1Token}`,
  };

  const staff2Token = generateSessionToken({ userId: staff2Id, role: 'STAFF' });
  const staff2Headers = {
    'Content-Type': 'application/json',
    Cookie: `${SESSION_COOKIE_NAME}=${staff2Token}`,
  };

  const adminToken = generateSessionToken({ userId: superAdminId, role: 'SUPER_ADMIN' });
  const adminHeaders = {
    'Content-Type': 'application/json',
    Cookie: `${SESSION_COOKIE_NAME}=${adminToken}`,
  };

  let passConcurrency = false;
  let passDeviceRule = false;
  let passNormalAdvance = false;
  let passStaleClick = false;
  let passDoublePress = false;
  let passMatchingSkip = false;
  let passStaleSkip = false;
  let passSkipNoCalled = false;
  let passDoublePressSkip = false;
  let passEmptyQueue = false;
  let passTwoSkipsNoCollision = false;

  // New Part 7 Auth & Admin test flags
  let passLoginSuccess = false;
  let passWrongPasswordGeneric = false;
  let passDeactivatedNoLogin = false;
  let passRateLimit10 = false;
  let passStaff403Unassigned = false;
  let passStaff403Admin = false;
  let passAdminPassesAdmin = false;
  let passSocketUnauthorizedJoin = false;
  let passTunnelOriginCorsAndSocket = false;
  let passDeactivateStaffAndInactiveLogin = false;
  let passPasswordResetStaff = false;

  let passStudentMe = false;
  let passStudentRegistration = false;
  let passStudentLink = false;
  let passStudentMismatch = false;
  let passDeviceAlreadyLinked = false;
  let passInvalidPhone = false;
  let passTicketUnregistered = false;
  let passTicketStudent = false;
  let passStudentTicketRule = false;
  let passStaffStudentVisibility = false;
  let passLegacyTicketFallback = false;
  let passPublicDisplayPrivacy = false;
  let passStaffNoLeak = false;

  try {
    // =========================================================================
    // 1. CONCURRENCY TEST
    // =========================================================================
    console.log('\n[1] Running concurrency test (10 simultaneous tickets)...');
    const deviceIds = Array.from({ length: 10 }, () => randomUUID());

    const registrationResponses = await Promise.all(
      deviceIds.map((deviceId, index) =>
        registerTestStudent(deviceId, `Test Student ${index}`, testStudentPhone(index))
      )
    );
    if (registrationResponses.some((response) => response.status !== 200)) {
      throw new Error(
        `Student setup failed with statuses: ${registrationResponses.map((r) => r.status).join(', ')}`
      );
    }

    const createRequests = deviceIds.map((deviceId) =>
      fetch(`${BASE_URL}/windows/${WINDOW_1_ID}/tickets`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ deviceId, serviceId: SERVICE_1_ID }),
      }).then((r) => r.json())
    );

    const createdResults = await Promise.all(createRequests);
    const obtainedNumbers = createdResults.map((r: any) => r.number).sort((a: number, b: number) => a - b);
    console.log('Obtained numbers:', obtainedNumbers);

    const hasNoGapsOrDups =
      obtainedNumbers.length === 10 &&
      obtainedNumbers.every((num: number, idx: number) => num === idx + 1);

    passConcurrency = hasNoGapsOrDups;
    console.log(`Concurrency result: ${passConcurrency ? 'PASS' : 'FAIL'}`);

    // =========================================================================
    // 2. DEVICE RULE TEST (Reject second active ticket)
    // =========================================================================
    console.log('\n[2] Running device rule test (duplicate active ticket)...');
    const duplicateRes = await fetch(`${BASE_URL}/windows/${WINDOW_1_ID}/tickets`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ deviceId: deviceIds[0], serviceId: SERVICE_1_ID }),
    });

    console.log('Duplicate request status:', duplicateRes.status);
    passDeviceRule = duplicateRes.status === 409;
    console.log(`Device rule result: ${passDeviceRule ? 'PASS' : 'FAIL'} (status: ${duplicateRes.status})`);

    // =========================================================================
    // 3. POST /next - NORMAL ADVANCE & SERVE
    // =========================================================================
    console.log('\n[3] Testing POST /next: normal advance and serve...');
    const call1Res = await fetch(`${BASE_URL}/windows/${WINDOW_1_ID}/next`, {
      method: 'POST',
      headers: staff1Headers,
      body: JSON.stringify({}),
    });
    const call1Json: any = await call1Res.json();
    const ticket1Id = call1Json.ticket?.id;
    console.log('Called ticket #1 id:', ticket1Id, 'number:', call1Json.ticket?.number);

    const call2Res = await fetch(`${BASE_URL}/windows/${WINDOW_1_ID}/next`, {
      method: 'POST',
      headers: staff1Headers,
      body: JSON.stringify({ currentTicketId: ticket1Id }),
    });
    const call2Json: any = await call2Res.json();
    const ticket2Id = call2Json.ticket?.id;
    console.log('Advanced to ticket #2 id:', ticket2Id, 'number:', call2Json.ticket?.number);

    const dbTicket1 = await prisma.ticket.findUnique({ where: { id: ticket1Id } });
    passNormalAdvance = dbTicket1?.status === 'served' && call2Json.ticket?.number === 2;
    console.log(`Normal advance & serve: ${passNormalAdvance ? 'PASS' : 'FAIL'} (ticket #1 status: ${dbTicket1?.status})`);

    // =========================================================================
    // 4. POST /next - STALE CLICK 409
    // =========================================================================
    console.log('\n[4] Testing POST /next: stale click returns 409...');
    const staleRes = await fetch(`${BASE_URL}/windows/${WINDOW_1_ID}/next`, {
      method: 'POST',
      headers: staff1Headers,
      body: JSON.stringify({ currentTicketId: ticket1Id }),
    });
    const staleJson: any = await staleRes.json();
    console.log('Stale click response status:', staleRes.status, 'Body:', staleJson);
    passStaleClick = staleRes.status === 409 && staleJson.error?.code === 'STALE_TICKET';
    console.log(`Stale click test: ${passStaleClick ? 'PASS' : 'FAIL'}`);

    // =========================================================================
    // 5. POST /next - DOUBLE PRESS PROTECTION
    // =========================================================================
    console.log('\n[5] Testing POST /next: double press does not skip a person...');
    const [clickA, clickB] = await Promise.all([
      fetch(`${BASE_URL}/windows/${WINDOW_1_ID}/next`, {
        method: 'POST',
        headers: staff1Headers,
        body: JSON.stringify({ currentTicketId: ticket2Id }),
      }),
      fetch(`${BASE_URL}/windows/${WINDOW_1_ID}/next`, {
        method: 'POST',
        headers: staff1Headers,
        body: JSON.stringify({ currentTicketId: ticket2Id }),
      }),
    ]);

    const statuses = [clickA.status, clickB.status];
    const isOneSuccessOne409 = statuses.includes(200) && statuses.includes(409);
    passDoublePress = isOneSuccessOne409;
    console.log(`Double press results: [clickA: ${clickA.status}, clickB: ${clickB.status}] -> ${passDoublePress ? 'PASS' : 'FAIL'}`);

    // =========================================================================
    // 6. POST /skip FUNCTIONALITY & SECURITY
    // =========================================================================
    console.log('\n[6] Testing POST /skip functionality & security...');
    const queueBeforeSkip: any = await (await fetch(`${BASE_URL}/windows/${WINDOW_1_ID}/queue`, { headers: staff1Headers })).json();
    const calledBeforeSkip = queueBeforeSkip.called;
    console.log('Currently called ticket #' + calledBeforeSkip?.number + ' ID:', calledBeforeSkip?.id);

    // 6a: Stale Skip
    const staleSkipRes = await fetch(`${BASE_URL}/windows/${WINDOW_1_ID}/skip`, {
      method: 'POST',
      headers: staff1Headers,
      body: JSON.stringify({ currentTicketId: ticket2Id }),
    });
    const staleSkipJson: any = await staleSkipRes.json();
    console.log('Stale skip response status:', staleSkipRes.status, 'Body:', staleSkipJson);
    const dbCalledAfterStale = await prisma.ticket.findUnique({ where: { id: calledBeforeSkip.id } });
    passStaleSkip = staleSkipRes.status === 409 && dbCalledAfterStale?.status === 'called';
    console.log(`Stale skip test: ${passStaleSkip ? 'PASS' : 'FAIL'} (ticket #${calledBeforeSkip.number} status: ${dbCalledAfterStale?.status})`);

    // 6b: Double Press Skip
    const [skipClickA, skipClickB] = await Promise.all([
      fetch(`${BASE_URL}/windows/${WINDOW_1_ID}/skip`, {
        method: 'POST',
        headers: staff1Headers,
        body: JSON.stringify({ currentTicketId: calledBeforeSkip.id }),
      }),
      fetch(`${BASE_URL}/windows/${WINDOW_1_ID}/skip`, {
        method: 'POST',
        headers: staff1Headers,
        body: JSON.stringify({ currentTicketId: calledBeforeSkip.id }),
      }),
    ]);
    const skipStatuses = [skipClickA.status, skipClickB.status];
    passDoublePressSkip = skipStatuses.includes(200) && skipStatuses.includes(409);
    console.log(`Double press skip results: [skipA: ${skipClickA.status}, skipB: ${skipClickB.status}]`);
    console.log(`Double press skip test: ${passDoublePressSkip ? 'PASS' : 'FAIL'}`);

    // 6c: Skip with No Called Ticket
    await prisma.ticket.updateMany({
      where: { windowId: WINDOW_1_ID, status: 'called' },
      data: { status: 'waiting' },
    });
    const noCalledSkipRes = await fetch(`${BASE_URL}/windows/${WINDOW_1_ID}/skip`, {
      method: 'POST',
      headers: staff1Headers,
      body: JSON.stringify({ currentTicketId: randomUUID() }),
    });
    const noCalledSkipJson: any = await noCalledSkipRes.json();
    passSkipNoCalled = noCalledSkipRes.status === 409 && noCalledSkipJson.error?.code === 'NO_CALLED_TICKET';
    console.log('No called skip response status:', noCalledSkipRes.status, 'Body:', noCalledSkipJson);
    console.log(`Skip with no called ticket test: ${passSkipNoCalled ? 'PASS' : 'FAIL'}`);

    // 6d: Matching Skip
    const call4Res = await fetch(`${BASE_URL}/windows/${WINDOW_1_ID}/next`, {
      method: 'POST',
      headers: staff1Headers,
      body: JSON.stringify({}),
    });
    const call4Json: any = await call4Res.json();
    const ticket4Id = call4Json.ticket?.id;

    const skip4Res = await fetch(`${BASE_URL}/windows/${WINDOW_1_ID}/skip`, {
      method: 'POST',
      headers: staff1Headers,
      body: JSON.stringify({ currentTicketId: ticket4Id }),
    });
    const skip4Json: any = await skip4Res.json();
    console.log(`Called ticket #${call4Json.ticket?.number} id: ${ticket4Id} number: ${call4Json.ticket?.number}`);
    console.log('Skip ticket #4 status:', skip4Res.status, 'sortKey:', skip4Json.ticket?.sortKey);
    const dbTicket4 = await prisma.ticket.findUnique({ where: { id: ticket4Id } });
    passMatchingSkip = skip4Res.status === 200 && dbTicket4?.status === 'waiting' && dbTicket4?.skipCount === 1;
    console.log(`Matching skip test: ${passMatchingSkip ? 'PASS' : 'FAIL'}`);

    // 6e: Two Skips
    const call5Res = await fetch(`${BASE_URL}/windows/${WINDOW_1_ID}/next`, {
      method: 'POST',
      headers: staff1Headers,
      body: JSON.stringify({}),
    });
    const call5Json: any = await call5Res.json();
    const ticket5Id = call5Json.ticket?.id;

    const skip5Res = await fetch(`${BASE_URL}/windows/${WINDOW_1_ID}/skip`, {
      method: 'POST',
      headers: staff1Headers,
      body: JSON.stringify({ currentTicketId: ticket5Id }),
    });
    const skip5Json: any = await skip5Res.json();
    console.log('Skip ticket #5 status:', skip5Res.status, 'sortKey:', skip5Json.ticket?.sortKey);

    const queueRes = await fetch(`${BASE_URL}/windows/${WINDOW_1_ID}/queue`, { headers: staff1Headers });
    const queueJson: any = await queueRes.json();
    const waitingTickets = queueJson.waiting;

    const sortKeys = waitingTickets.map((t: any) => t.sortKey);
    const waitingNums = waitingTickets.map((t: any) => t.number);
    console.log('Waiting tickets sortKeys:', sortKeys);
    console.log('Waiting tickets order by number:', waitingNums);

    const uniqueKeys = new Set(sortKeys).size === sortKeys.length;
    const isSortedAscending = sortKeys.every((val: number, i: number) => i === 0 || val >= sortKeys[i - 1]);
    passTwoSkipsNoCollision = uniqueKeys && isSortedAscending;
    console.log(`Two skips collision-free test: ${passTwoSkipsNoCollision ? 'PASS' : 'FAIL'} (all unique: ${uniqueKeys}, ascending: ${isSortedAscending})`);

    // =========================================================================
    // 7. EMPTY QUEUE TEST
    // =========================================================================
    console.log('\n[7] Testing POST /next on empty queue...');
    await prisma.ticket.deleteMany({
      where: { windowId: WINDOW_1_ID },
    });

    const emptyRes = await fetch(`${BASE_URL}/windows/${WINDOW_1_ID}/next`, {
      method: 'POST',
      headers: staff1Headers,
      body: JSON.stringify({}),
    });
    const emptyJson: any = await emptyRes.json();
    passEmptyQueue = emptyRes.status === 200 && emptyJson.ticket === null;
    console.log(`Empty queue test: ${passEmptyQueue ? 'PASS' : 'FAIL'}`);

    // =========================================================================
    // 8. AUTH - LOGIN SUCCESS
    // =========================================================================
    console.log('\n[8] Testing POST /api/auth/login success & cookie issuance...');
    const loginRes = await fetch(`${BASE_URL}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: 'test_admin@dawrak.faculty.edu',
        password: defaultPassword,
      }),
    });
    const loginCookie = loginRes.headers.get('set-cookie');
    const loginJson: any = await loginRes.json();
    passLoginSuccess =
      loginRes.status === 200 &&
      loginJson.user?.role === 'SUPER_ADMIN' &&
      Boolean(loginCookie && loginCookie.includes(SESSION_COOKIE_NAME));
    console.log(`Login success test: ${passLoginSuccess ? 'PASS' : 'FAIL'}`);

    // =========================================================================
    // 9. AUTH - WRONG PASSWORD RETURNS GENERIC ERROR
    // =========================================================================
    console.log('\n[9] Testing POST /api/auth/login wrong password generic error...');
    const wrongPassRes = await fetch(`${BASE_URL}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: 'test_admin@dawrak.faculty.edu',
        password: 'IncorrectPassword999!',
      }),
    });
    const wrongPassJson: any = await wrongPassRes.json();
    passWrongPasswordGeneric =
      wrongPassRes.status === 401 &&
      wrongPassJson.error?.code === 'INVALID_CREDENTIALS' &&
      wrongPassJson.error?.message === 'البريد الإلكتروني أو كلمة المرور غير صحيحة';
    console.log(`Wrong password generic message test: ${passWrongPasswordGeneric ? 'PASS' : 'FAIL'}`);

    // =========================================================================
    // 10. AUTH - DEACTIVATED USER CANNOT LOG IN
    // =========================================================================
    console.log('\n[10] Testing POST /api/auth/login deactivated user cannot log in...');
    const deactRes = await fetch(`${BASE_URL}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: 'test_inactive@dawrak.faculty.edu',
        password: defaultPassword,
      }),
    });
    const deactJson: any = await deactRes.json();
    passDeactivatedNoLogin = deactRes.status === 403 && deactJson.error?.code === 'USER_INACTIVE';
    console.log(`Deactivated user cannot log in test: ${passDeactivatedNoLogin ? 'PASS' : 'FAIL'}`);

    // =========================================================================
    // 11. AUTH - RATE LIMIT TRIGGERS AFTER 10 ATTEMPTS
    // =========================================================================
    console.log('\n[11] Testing POST /api/auth/login rate limiter...');
    let hitRateLimit = false;
    for (let i = 0; i < 12; i++) {
      const rlRes = await fetch(`${BASE_URL}/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: 'rate_test@dawrak.faculty.edu',
          password: 'RandomPassword123!',
        }),
      });
      if (rlRes.status === 429) {
        hitRateLimit = true;
        break;
      }
    }
    passRateLimit10 = hitRateLimit;
    console.log(`Rate limit triggers test: ${passRateLimit10 ? 'PASS' : 'FAIL'}`);

    // =========================================================================
    // 12. AUTHZ - STAFF 403 ON UNASSIGNED WINDOW
    // =========================================================================
    console.log('\n[12] Testing staff 403 on unassigned window routes...');
    const unassignedNextRes = await fetch(`${BASE_URL}/windows/${WINDOW_1_ID}/next`, {
      method: 'POST',
      headers: staff2Headers, // staff 2 is only assigned to Window 2
      body: JSON.stringify({}),
    });
    const unassignedNextJson: any = await unassignedNextRes.json();

    const unassignedQueueRes = await fetch(`${BASE_URL}/windows/${WINDOW_1_ID}/queue`, {
      headers: staff2Headers,
    });

    passStaff403Unassigned =
      unassignedNextRes.status === 403 &&
      unassignedNextJson.error?.code === 'FORBIDDEN' &&
      unassignedQueueRes.status === 403;
    console.log(`Staff 403 on unassigned window test: ${passStaff403Unassigned ? 'PASS' : 'FAIL'}`);

    // =========================================================================
    // 13. AUTHZ - STAFF 403 ON ADMIN ROUTES
    // =========================================================================
    console.log('\n[13] Testing staff 403 on admin routes...');
    const staffAdminRes = await fetch(`${BASE_URL}/admin/windows`, {
      headers: staff1Headers,
    });
    const staffAdminJson: any = await staffAdminRes.json();
    passStaff403Admin = staffAdminRes.status === 403 && staffAdminJson.error?.code === 'FORBIDDEN';
    console.log(`Staff 403 on admin routes test: ${passStaff403Admin ? 'PASS' : 'FAIL'}`);

    // =========================================================================
    // 14. AUTHZ - SUPER ADMIN PASSES ADMIN ROUTES & CANNOT DEACTIVATE SELF
    // =========================================================================
    console.log('\n[14] Testing super admin access to admin routes & self deactivation protection...');
    const adminGetWindowsRes = await fetch(`${BASE_URL}/admin/windows`, {
      headers: adminHeaders,
    });
    const adminWindowsJson: any = await adminGetWindowsRes.json();

    // Try self deactivation
    const selfDeactRes = await fetch(`${BASE_URL}/admin/users/${superAdminId}`, {
      method: 'PATCH',
      headers: adminHeaders,
      body: JSON.stringify({ isActive: false }),
    });
    const selfDeactJson: any = await selfDeactRes.json();

    passAdminPassesAdmin =
      adminGetWindowsRes.status === 200 &&
      Array.isArray(adminWindowsJson) &&
      selfDeactRes.status === 400 &&
      selfDeactJson.error?.code === 'CANNOT_DEACTIVATE_SELF';
    console.log(`Super admin passes admin routes & cannot deactivate self: ${passAdminPassesAdmin ? 'PASS' : 'FAIL'}`);

    // =========================================================================
    // 15. SOCKET.IO - REJECT UNASSIGNED STAFF JOIN
    // =========================================================================
    console.log('\n[15] Testing Socket.IO unauthorized room join rejection...');
    const socketStaff2 = ioc(`http://localhost:${TEST_PORT}`, {
      extraHeaders: {
        Cookie: `${SESSION_COOKIE_NAME}=${staff2Token}`,
      },
      transports: ['websocket'],
    });

    const socketErrorReceived: any = await new Promise((resolve) => {
      const timer = setTimeout(() => resolve(null), 3000);
      socketStaff2.on('connect', () => {
        // Try joining Window 1 (which staff 2 is NOT assigned to)
        socketStaff2.emit('join:window', WINDOW_1_ID);
      });
      socketStaff2.on('error', (err: any) => {
        clearTimeout(timer);
        resolve(err);
      });
    });

    socketStaff2.disconnect();

    passSocketUnauthorizedJoin =
      socketErrorReceived?.code === 'FORBIDDEN' &&
      socketErrorReceived?.message?.includes('صلاحية');
    console.log(`Socket.IO unauthorized join rejected test: ${passSocketUnauthorizedJoin ? 'PASS' : 'FAIL'}`);

    // =========================================================================
    // 16. NETWORK & TUNNEL ORIGIN CORS / SOCKET.IO TEST
    // =========================================================================
    console.log('\n[16] Testing Tunnel Origin CORS and Socket.IO acceptance vs Unknown origin rejection...');
    const tunnelOrigin = 'https://attraction-filtering-cingular-chancellor.trycloudflare.com';
    const unknownOrigin = 'https://evil-unauthorized-site.com';

    // Express CORS check - Tunnel origin allowed
    const tunnelCorsRes = await fetch(`${BASE_URL}/health`, {
      headers: { Origin: tunnelOrigin },
    });
    const tunnelAllowHeader = tunnelCorsRes.headers.get('access-control-allow-origin');

    // Express CORS check - Unknown origin rejected (header omitted or not equal)
    const unknownCorsRes = await fetch(`${BASE_URL}/health`, {
      headers: { Origin: unknownOrigin },
    });
    const unknownAllowHeader = unknownCorsRes.headers.get('access-control-allow-origin');

    // Socket.IO check - Tunnel origin allowed
    const tunnelSocket = ioc(`http://localhost:${TEST_PORT}`, {
      extraHeaders: { origin: tunnelOrigin },
      transports: ['polling', 'websocket'],
      timeout: 3000,
    });
    const tunnelConnected = await new Promise<boolean>((resolve) => {
      const timer = setTimeout(() => resolve(false), 3000);
      tunnelSocket.on('connect', () => {
        clearTimeout(timer);
        resolve(true);
      });
      tunnelSocket.on('connect_error', () => {
        clearTimeout(timer);
        resolve(false);
      });
    });
    tunnelSocket.disconnect();

    // Socket.IO check - Unknown origin rejected
    const unknownSocket = ioc(`http://localhost:${TEST_PORT}`, {
      extraHeaders: { origin: unknownOrigin },
      transports: ['polling', 'websocket'],
      timeout: 3000,
    });
    const unknownRejected = await new Promise<boolean>((resolve) => {
      const timer = setTimeout(() => resolve(false), 2000);
      unknownSocket.on('connect', () => {
        clearTimeout(timer);
        resolve(false);
      });
      unknownSocket.on('connect_error', () => {
        clearTimeout(timer);
        resolve(true);
      });
    });
    unknownSocket.disconnect();

    passTunnelOriginCorsAndSocket =
      tunnelAllowHeader === tunnelOrigin &&
      unknownAllowHeader !== unknownOrigin &&
      tunnelConnected === true &&
      unknownRejected === true;
    console.log(`Tunnel origin allowed & unknown origin rejected: ${passTunnelOriginCorsAndSocket ? 'PASS' : 'FAIL'}`);

    // =========================================================================
    // 17. SUPER ADMIN DEACTIVATES STAFF & VERIFIES USER_INACTIVE
    // =========================================================================
    console.log('\n[17] Testing Super Admin deactivating staff account & login failure with USER_INACTIVE...');
    // Deactivate staff 1
    const staffDeactRes = await fetch(`${BASE_URL}/admin/users/${staff1Id}`, {
      method: 'PATCH',
      headers: adminHeaders,
      body: JSON.stringify({ isActive: false }),
    });
    const staffDeactJson: any = await staffDeactRes.json();

    // Attempt staff 1 login while deactivated
    const deactLoginRes = await fetch(`${BASE_URL}/auth/login`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-skip-rate-limit': 'true',
      },
      body: JSON.stringify({
        email: 'test_staff1@dawrak.faculty.edu',
        password: defaultPassword,
      }),
    });
    const deactLoginJson: any = await deactLoginRes.json();

    // Re-activate staff 1
    await fetch(`${BASE_URL}/admin/users/${staff1Id}`, {
      method: 'PATCH',
      headers: adminHeaders,
      body: JSON.stringify({ isActive: true }),
    });

    passDeactivateStaffAndInactiveLogin =
      staffDeactRes.status === 200 &&
      staffDeactJson.isActive === false &&
      deactLoginRes.status === 403 &&
      deactLoginJson.error?.code === 'USER_INACTIVE';
    console.log(`Deactivated staff login fails with USER_INACTIVE: ${passDeactivateStaffAndInactiveLogin ? 'PASS' : 'FAIL'}`);

    // =========================================================================
    // 18. SUPER ADMIN RESETS STAFF PASSWORD
    // =========================================================================
    console.log('\n[18] Testing Super Admin password reset for staff...');
    const newStaffPassword = 'NewSecretStaffPass2026!';
    const resetRes = await fetch(`${BASE_URL}/admin/users/${staff1Id}`, {
      method: 'PATCH',
      headers: adminHeaders,
      body: JSON.stringify({ password: newStaffPassword }),
    });

    // Old password should fail
    const oldPassLoginRes = await fetch(`${BASE_URL}/auth/login`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-skip-rate-limit': 'true',
      },
      body: JSON.stringify({
        email: 'test_staff1@dawrak.faculty.edu',
        password: defaultPassword,
      }),
    });

    // New password should succeed
    const newPassLoginRes = await fetch(`${BASE_URL}/auth/login`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-skip-rate-limit': 'true',
      },
      body: JSON.stringify({
        email: 'test_staff1@dawrak.faculty.edu',
        password: newStaffPassword,
      }),
    });
    const setCookie = newPassLoginRes.headers.get('set-cookie');

    // Restore default password
    await fetch(`${BASE_URL}/admin/users/${staff1Id}`, {
      method: 'PATCH',
      headers: adminHeaders,
      body: JSON.stringify({ password: defaultPassword }),
    });

    passPasswordResetStaff =
      resetRes.status === 200 &&
      oldPassLoginRes.status === 401 &&
      newPassLoginRes.status === 200 &&
      Boolean(setCookie?.includes(SESSION_COOKIE_NAME));
    console.log(`Password reset: new works, old fails: ${passPasswordResetStaff ? 'PASS' : 'FAIL'}`);

    // =========================================================================
    // 19. STUDENT IDENTITY - GET /me & REGISTRATION
    // =========================================================================
    console.log('\n[19] Testing student identity and registration...');
    const unknownStudentDeviceId = randomUUID();
    const unknownMeRes = await fetch(
      `${BASE_URL}/student/me?device_id=${unknownStudentDeviceId}`
    );
    const unknownMeJson: any = await unknownMeRes.json();

    const identityDeviceA = randomUUID();
    const identityDeviceB = randomUUID();
    const identityPhone = testStudentPhone(100);
    const createStudentRes = await registerTestStudent(
      identityDeviceA,
      '  Ahmed   Ali  ',
      '0109999-0100'
    );
    const createStudentJson: any = await createStudentRes.json();

    const linkedMeRes = await fetch(`${BASE_URL}/student/me?device_id=${identityDeviceA}`);
    const linkedMeJson: any = await linkedMeRes.json();
    const identityStudentCount = await prisma.student.count({
      where: { phone: identityPhone },
    });
    const identityDeviceLinkCount = await prisma.studentDevice.count({
      where: { deviceId: identityDeviceA },
    });

    passStudentMe =
      unknownMeRes.status === 404 &&
      unknownMeJson.error?.code === 'STUDENT_NOT_REGISTERED' &&
      linkedMeRes.status === 200 &&
      linkedMeJson.id === createStudentJson.id;

    passStudentRegistration =
      createStudentRes.status === 200 &&
      createStudentJson.fullName === 'Ahmed Ali' &&
      createStudentJson.phone === identityPhone &&
      identityStudentCount === 1 &&
      identityDeviceLinkCount === 1;

    const linkStudentRes = await registerTestStudent(
      identityDeviceB,
      ' Ahmed   Ali ',
      '+20 109 999 0100'
    );
    const linkStudentJson: any = await linkStudentRes.json();
    const studentCountAfterLink = await prisma.student.count({
      where: { phone: identityPhone },
    });
    const linkedDeviceCount = await prisma.studentDevice.count({
      where: { studentId: createStudentJson.id },
    });
    const storedStudent = await prisma.student.findUnique({
      where: { phone: identityPhone },
    });

    passStudentLink =
      linkStudentRes.status === 200 &&
      linkStudentJson.id === createStudentJson.id &&
      studentCountAfterLink === 1 &&
      linkedDeviceCount === 2 &&
      storedStudent?.fullName === 'Ahmed Ali';

    const mismatchDeviceId = randomUUID();
    const mismatchRes = await registerTestStudent(
      mismatchDeviceId,
      'Ahmed Aly',
      identityPhone
    );
    const mismatchJson: any = await mismatchRes.json();
    const mismatchBody = JSON.stringify(mismatchJson);
    passStudentMismatch =
      mismatchRes.status === 409 &&
      mismatchJson.error?.code === 'PHONE_NAME_MISMATCH' &&
      mismatchJson.error?.message ===
        'البيانات دي مش مطابقة لسجل موجود، تأكد من الاسم والرقم أو كلم شؤون الطلاب.' &&
      !mismatchBody.includes('Ahmed Ali');

    const deviceConflictRes = await registerTestStudent(
      identityDeviceA,
      'Another Student',
      testStudentPhone(101)
    );
    const deviceConflictJson: any = await deviceConflictRes.json();
    const unlinkedPhoneStudentCount = await prisma.student.count({
      where: { phone: testStudentPhone(101) },
    });
    passDeviceAlreadyLinked =
      deviceConflictRes.status === 409 &&
      deviceConflictJson.error?.code === 'DEVICE_ALREADY_LINKED' &&
      unlinkedPhoneStudentCount === 0;

    const invalidPhoneDeviceId = randomUUID();
    const invalidPhoneRes = await registerTestStudent(
      invalidPhoneDeviceId,
      'Valid Student',
      '02012345678'
    );
    const invalidPhoneJson: any = await invalidPhoneRes.json();
    const invalidPhoneStudentCount = await prisma.student.count({
      where: { phone: '02012345678' },
    });
    const invalidPhoneLinkCount = await prisma.studentDevice.count({
      where: { deviceId: invalidPhoneDeviceId },
    });
    passInvalidPhone =
      invalidPhoneRes.status === 400 &&
      invalidPhoneJson.error?.code === 'INVALID_INPUT' &&
      invalidPhoneStudentCount === 0 &&
      invalidPhoneLinkCount === 0;

    console.log(
      `Student identity: me=${passStudentMe ? 'PASS' : 'FAIL'}, registration=${
        passStudentRegistration ? 'PASS' : 'FAIL'
      }, link=${passStudentLink ? 'PASS' : 'FAIL'}, mismatch=${
        passStudentMismatch ? 'PASS' : 'FAIL'
      }, device=${passDeviceAlreadyLinked ? 'PASS' : 'FAIL'}, phone=${
        passInvalidPhone ? 'PASS' : 'FAIL'
      }`
    );

    // =========================================================================
    // 20. TICKET CREATION WITH STUDENT IDENTITY
    // =========================================================================
    console.log('\n[20] Testing ticket creation with student identity...');
    await prisma.ticket.deleteMany({
      where: { windowId: WINDOW_1_ID },
    });

    const unregisteredTicketDeviceId = randomUUID();
    const unregisteredTicketRes = await fetch(
      `${BASE_URL}/windows/${WINDOW_1_ID}/tickets`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          deviceId: unregisteredTicketDeviceId,
          serviceId: SERVICE_1_ID,
        }),
      }
    );
    const unregisteredTicketJson: any = await unregisteredTicketRes.json();
    passTicketUnregistered =
      unregisteredTicketRes.status === 404 &&
      unregisteredTicketJson.error?.code === 'STUDENT_NOT_REGISTERED';

    const studentTicketRes = await fetch(`${BASE_URL}/windows/${WINDOW_1_ID}/tickets`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ deviceId: identityDeviceA, serviceId: SERVICE_1_ID }),
    });
    const studentTicketJson: any = await studentTicketRes.json();
    const dbStudentTicket = await prisma.ticket.findUnique({
      where: { id: studentTicketJson.id },
    });
    passTicketStudent =
      studentTicketRes.status === 201 && dbStudentTicket?.studentId === createStudentJson.id;

    const sameStudentTicketRes = await fetch(
      `${BASE_URL}/windows/${WINDOW_1_ID}/tickets`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ deviceId: identityDeviceB, serviceId: SERVICE_1_ID }),
      }
    );
    const sameStudentTicketJson: any = await sameStudentTicketRes.json();
    passStudentTicketRule =
      sameStudentTicketRes.status === 409 &&
      sameStudentTicketJson.error?.code === 'ACTIVE_TICKET_EXISTS';

    const sameDeviceTicketRes = await fetch(
      `${BASE_URL}/windows/${WINDOW_1_ID}/tickets`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ deviceId: identityDeviceA, serviceId: SERVICE_1_ID }),
      }
    );
    const sameDeviceTicketJson: any = await sameDeviceTicketRes.json();
    passDeviceRule =
      sameDeviceTicketRes.status === 409 &&
      sameDeviceTicketJson.error?.code === 'ACTIVE_TICKET_EXISTS';

    console.log(
      `Ticket identity: unregistered=${passTicketUnregistered ? 'PASS' : 'FAIL'}, stored=${
        passTicketStudent ? 'PASS' : 'FAIL'
      }, studentRule=${passStudentTicketRule ? 'PASS' : 'FAIL'}, deviceRule=${
        passDeviceRule ? 'PASS' : 'FAIL'
      }`
    );

    // =========================================================================
    // 21. STAFF VISIBILITY, LEGACY FALLBACK & PUBLIC DISPLAY PRIVACY
    // =========================================================================
    console.log('\n[21] Testing staff visibility, legacy tickets, and public display privacy...');
    const secondIdentityDevice = randomUUID();
    const secondIdentityPhone = testStudentPhone(102);
    const secondIdentityRes = await registerTestStudent(
      secondIdentityDevice,
      'Mona Test',
      secondIdentityPhone
    );
    const secondIdentityJson: any = await secondIdentityRes.json();
    const secondStudentTicketRes = await fetch(
      `${BASE_URL}/windows/${WINDOW_1_ID}/tickets`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ deviceId: secondIdentityDevice, serviceId: SERVICE_1_ID }),
      }
    );
    const secondStudentTicketJson: any = await secondStudentTicketRes.json();

    const callIdentityTicketRes = await fetch(
      `${BASE_URL}/windows/${WINDOW_1_ID}/next`,
      {
        method: 'POST',
        headers: staff1Headers,
        body: JSON.stringify({}),
      }
    );
    await callIdentityTicketRes.json();

    const legacyTicket = await prisma.ticket.create({
      data: {
        windowId: WINDOW_1_ID,
        serviceId: SERVICE_1_ID,
        deviceId: randomUUID(),
        studentId: null,
        queueDate: getCairoDate(),
        number: 999,
        status: 'waiting',
        sortKey: 999,
      },
    });

    const assignedQueueRes = await fetch(`${BASE_URL}/windows/${WINDOW_1_ID}/queue`, {
      headers: staff1Headers,
    });
    const assignedQueueJson: any = await assignedQueueRes.json();
    const waitingLegacy = assignedQueueJson.waiting?.find(
      (ticket: any) => ticket.id === legacyTicket.id
    );
    const waitingSecondStudent = assignedQueueJson.waiting?.find(
      (ticket: any) => ticket.id === secondStudentTicketJson.id
    );

    passStaffStudentVisibility =
      assignedQueueRes.status === 200 &&
      assignedQueueJson.called?.student?.fullName === 'Ahmed Ali' &&
      assignedQueueJson.called?.student?.phone === identityPhone &&
      waitingSecondStudent?.student?.fullName === 'Mona Test' &&
      waitingSecondStudent?.student?.phone === secondIdentityPhone;

    passLegacyTicketFallback =
      waitingLegacy !== undefined && waitingLegacy.student === null;

    const displayRes = await fetch(`${BASE_URL}/windows/${WINDOW_1_ID}/display`);
    const displayJson: any = await displayRes.json();
    const displayBody = JSON.stringify(displayJson);
    passPublicDisplayPrivacy =
      displayRes.status === 200 &&
      displayJson.called?.number === studentTicketJson.number &&
      displayJson.called?.student === undefined &&
      !displayBody.includes('Ahmed Ali') &&
      !displayBody.includes(identityPhone);

    const noLeakQueueRes = await fetch(`${BASE_URL}/windows/${WINDOW_1_ID}/queue`, {
      headers: staff2Headers,
    });
    const noLeakQueueBody = await noLeakQueueRes.text();
    passStaffNoLeak =
      noLeakQueueRes.status === 403 &&
      !noLeakQueueBody.includes('Ahmed Ali') &&
      !noLeakQueueBody.includes(identityPhone);

    console.log(
      `Staff/privacy: visibility=${passStaffStudentVisibility ? 'PASS' : 'FAIL'}, legacy=${
        passLegacyTicketFallback ? 'PASS' : 'FAIL'
      }, display=${passPublicDisplayPrivacy ? 'PASS' : 'FAIL'}, noLeak=${
        passStaffNoLeak ? 'PASS' : 'FAIL'
      }`
    );

  } finally {
    await prisma.ticket.deleteMany({
      where: { windowId: WINDOW_1_ID },
    });
    await prisma.student.deleteMany({
      where: { phone: { startsWith: TEST_STUDENT_PHONE_PREFIX } },
    });
    console.log('\nCleaned up test tickets and students.');

    await new Promise<void>((resolve) => {
      server.close(() => {
        console.log('Test server stopped.');
        resolve();
      });
    });
    await prisma.$disconnect();
  }

  console.log('\n--- ALL TESTS SUMMARY ---');
  console.log('1. Concurrency (10 tickets, no gaps/dups):', passConcurrency ? 'PASS' : 'FAIL');
  console.log('2. Device Rule (409 on duplicate active):', passDeviceRule ? 'PASS' : 'FAIL');
  console.log('3. Normal Advance & Serve (/next marks served):', passNormalAdvance ? 'PASS' : 'FAIL');
  console.log('4. Stale Click (409 STALE_TICKET):', passStaleClick ? 'PASS' : 'FAIL');
  console.log('5. Double Press Protection (second fails 409):', passDoublePress ? 'PASS' : 'FAIL');
  console.log('6a. Stale Skip (409 STALE_TICKET, leaves called intact):', passStaleSkip ? 'PASS' : 'FAIL');
  console.log('6b. Double Press Skip Protection (second fails 409):', passDoublePressSkip ? 'PASS' : 'FAIL');
  console.log('6c. Skip with No Called Ticket (409 NO_CALLED_TICKET):', passSkipNoCalled ? 'PASS' : 'FAIL');
  console.log('6d. Matching Skip (200, status waiting, skipCount 1):', passMatchingSkip ? 'PASS' : 'FAIL');
  console.log('6e. Two Skips Collision-Free & Unique sort_keys:', passTwoSkipsNoCollision ? 'PASS' : 'FAIL');
  console.log('7. Empty Queue (/next returns ticket: null):', passEmptyQueue ? 'PASS' : 'FAIL');
  console.log('8. Login success with httpOnly cookie:', passLoginSuccess ? 'PASS' : 'FAIL');
  console.log('9. Wrong password returns generic message:', passWrongPasswordGeneric ? 'PASS' : 'FAIL');
  console.log('10. Deactivated user cannot log in (403):', passDeactivatedNoLogin ? 'PASS' : 'FAIL');
  console.log('11. Rate limit triggers after 10 attempts (429):', passRateLimit10 ? 'PASS' : 'FAIL');
  console.log('12. Staff 403 on unassigned window (/next, /queue):', passStaff403Unassigned ? 'PASS' : 'FAIL');
  console.log('13. Staff 403 on admin routes:', passStaff403Admin ? 'PASS' : 'FAIL');
  console.log('14. Super admin passes admin routes & cannot deactivate self:', passAdminPassesAdmin ? 'PASS' : 'FAIL');
  console.log('15. Socket.IO join rejected for unassigned staff:', passSocketUnauthorizedJoin ? 'PASS' : 'FAIL');
  console.log('16. Tunnel origin allowed & unknown origin rejected (CORS & Socket):', passTunnelOriginCorsAndSocket ? 'PASS' : 'FAIL');
  console.log('17. Deactivated staff login fails with USER_INACTIVE:', passDeactivateStaffAndInactiveLogin ? 'PASS' : 'FAIL');
  console.log('18. Password reset (new works, old fails):', passPasswordResetStaff ? 'PASS' : 'FAIL');
  console.log('19. Student /me (unknown 404, linked returns):', passStudentMe ? 'PASS' : 'FAIL');
  console.log('20. Student registration (new + returning device):', passStudentRegistration ? 'PASS' : 'FAIL');
  console.log('21. New device links existing student (name normalized):', passStudentLink ? 'PASS' : 'FAIL');
  console.log('22. Phone/name mismatch rejected without leaking name:', passStudentMismatch ? 'PASS' : 'FAIL');
  console.log('23. Device already linked to another student rejected:', passDeviceAlreadyLinked ? 'PASS' : 'FAIL');
  console.log('24. Invalid Egyptian phone rejected with no writes:', passInvalidPhone ? 'PASS' : 'FAIL');
  console.log('25. Ticket creation requires registered student:', passTicketUnregistered ? 'PASS' : 'FAIL');
  console.log('26. Ticket stores server-resolved student_id:', passTicketStudent ? 'PASS' : 'FAIL');
  console.log('27. Same student second device rejected:', passStudentTicketRule ? 'PASS' : 'FAIL');
  console.log('28. Staff visibility + legacy fallback:', passStaffStudentVisibility && passLegacyTicketFallback ? 'PASS' : 'FAIL');
  console.log('29. Public display privacy + unassigned staff no leak:', passPublicDisplayPrivacy && passStaffNoLeak ? 'PASS' : 'FAIL');

  const allPassed =
    passConcurrency &&
    passDeviceRule &&
    passNormalAdvance &&
    passStaleClick &&
    passDoublePress &&
    passStaleSkip &&
    passDoublePressSkip &&
    passSkipNoCalled &&
    passMatchingSkip &&
    passTwoSkipsNoCollision &&
    passEmptyQueue &&
    passLoginSuccess &&
    passWrongPasswordGeneric &&
    passDeactivatedNoLogin &&
    passRateLimit10 &&
    passStaff403Unassigned &&
    passStaff403Admin &&
    passAdminPassesAdmin &&
    passSocketUnauthorizedJoin &&
    passTunnelOriginCorsAndSocket &&
    passDeactivateStaffAndInactiveLogin &&
    passPasswordResetStaff &&
    passStudentMe &&
    passStudentRegistration &&
    passStudentLink &&
    passStudentMismatch &&
    passDeviceAlreadyLinked &&
    passInvalidPhone &&
    passTicketUnregistered &&
    passTicketStudent &&
    passStudentTicketRule &&
    passStaffStudentVisibility &&
    passLegacyTicketFallback &&
    passPublicDisplayPrivacy &&
    passStaffNoLeak;

  if (!allPassed) {
    process.exit(1);
  }
}

runTests().catch((err) => {
  console.error('Fatal test error:', err);
  process.exit(1);
});

import { chromium } from 'playwright';
import path from 'path';
import fs from 'fs';

const TUNNEL_URL = 'https://attraction-filtering-cingular-chancellor.trycloudflare.com';
const SCREENSHOT_DIR = '/mnt/user-data/outputs/screenshots/demo-v2';
const WINDOW_1_ID = '00000000-0000-4000-8000-000000000001';

const MOBILE_VIEWPORT = { width: 360, height: 780 };
const MOBILE_USER_AGENT =
  'Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Mobile/15E148 Safari/604.1';

async function main() {
  console.log('--- Starting Demo v2 Verification Suite ---');
  if (!fs.existsSync(SCREENSHOT_DIR)) {
    fs.mkdirSync(SCREENSHOT_DIR, { recursive: true });
  }

  const browser = await chromium.launch({ headless: true });

  const consoleErrors = [];
  function attachConsoleMonitor(page, label) {
    page.on('response', (res) => {
      if (res.status() >= 400) {
        console.log(`[${label} HTTP ${res.status()}]:`, res.url());
      }
    });
    page.on('console', (msg) => {
      const type = msg.type();
      const text = msg.text();
      if (type === 'error') {
        console.log(`[${label} ERROR]:`, text);
        consoleErrors.push({ label, text });
      }
    });
    page.on('pageerror', (err) => {
      console.log(`[${label} PAGE ERROR]:`, err.message);
      consoleErrors.push({ label, text: err.message });
    });
  }

  // =========================================================================
  // 1. LOGIN PAGE AT 360px THROUGH TUNNEL
  // =========================================================================
  console.log('\n[1] Checking Login page at 360px through Cloudflare tunnel...');
  const mobileContext = await browser.newContext({
    viewport: MOBILE_VIEWPORT,
    userAgent: MOBILE_USER_AGENT,
    isMobile: true,
  });
  const loginPage = await mobileContext.newPage();
  attachConsoleMonitor(loginPage, 'LoginPage');

  await loginPage.goto(`${TUNNEL_URL}/login`, { waitUntil: 'networkidle' });
  await loginPage.waitForSelector('text=بوابة طاقم العمل');
  await loginPage.waitForSelector('text=دَوْرَك');

  const loginScreenshot = path.join(SCREENSHOT_DIR, 'login-360px.png');
  await loginPage.screenshot({ path: loginScreenshot });
  console.log(`Saved screenshot: ${loginScreenshot}`);

  // =========================================================================
  // 2. STUDENT WINDOW PAGE AT 360px THROUGH TUNNEL
  // =========================================================================
  console.log('\n[2] Checking Student window page at 360px through Cloudflare tunnel...');
  const studentPage = await mobileContext.newPage();
  attachConsoleMonitor(studentPage, 'StudentPage');

  await studentPage.goto(`${TUNNEL_URL}/w/${WINDOW_1_ID}`, { waitUntil: 'networkidle' });
  await studentPage.waitForSelector('text=دَوْرَك');
  await studentPage.waitForSelector('text=اختر الخدمة المطلوبة');

  const studentScreenshot = path.join(SCREENSHOT_DIR, 'student-window-360px.png');
  await studentPage.screenshot({ path: studentScreenshot });
  console.log(`Saved screenshot: ${studentScreenshot}`);

  // =========================================================================
  // 3. STAFF PANEL AT 360px & PUBLIC DISPLAY PAGE LIVE UPDATES
  // =========================================================================
  console.log('\n[3] Setting up Staff Panel & Public Display Page for live socket test...');

  // Staff Context
  const staffContext = await browser.newContext({
    viewport: MOBILE_VIEWPORT,
    userAgent: MOBILE_USER_AGENT,
    isMobile: true,
  });
  const staffPage = await staffContext.newPage();
  attachConsoleMonitor(staffPage, 'StaffPage');

  await staffPage.goto(`${TUNNEL_URL}/login`, { waitUntil: 'networkidle' });
  await staffPage.fill('input[type="email"]', 'ahmed.staff@dawrak.faculty.edu');
  await staffPage.fill('input[type="password"]', 'StaffPassword123!');
  await staffPage.click('button[type="submit"]');

  await staffPage.waitForURL(`**/admin/${WINDOW_1_ID}`);
  await staffPage.waitForSelector('text=لوحة موظف الشباك');
  console.log('Staff logged in and connected to Window 1 panel.');

  // Display Page Context (360px mobile context)
  const displayContext = await browser.newContext({
    viewport: MOBILE_VIEWPORT,
    userAgent: MOBILE_USER_AGENT,
    isMobile: true,
  });
  const displayPage = await displayContext.newPage();
  attachConsoleMonitor(displayPage, 'DisplayPage');

  await displayPage.goto(`${TUNNEL_URL}/display/${WINDOW_1_ID}`, { waitUntil: 'networkidle' });
  await displayPage.waitForSelector('text=شاشة العرض العامة');
  await displayPage.waitForSelector('text=لا يوجد دور حالي');
  console.log('Public Display Page connected and confirms empty state "لا يوجد دور حالي".');

  // Student takes a ticket
  console.log('Student taking a ticket via tunnel...');
  const serviceButton = studentPage.locator('button:has-text("اضغط للحصول على رقم دور")').first();
  await serviceButton.click();

  // Wait for ticket tracking page
  await studentPage.waitForURL(`**/w/${WINDOW_1_ID}/ticket/**`);
  console.log('Student received ticket successfully.');

  // Confirm staff panel updates live with ticket in waiting list
  console.log('Checking live update on Staff panel...');
  await staffPage.waitForSelector('text=تذكرة #', { timeout: 10000 });
  await staffPage.waitForSelector('text=1 بانتظار الخدمة', { timeout: 10000 });
  const staffScreenshot = path.join(SCREENSHOT_DIR, 'staff-panel-360px-ticket.png');
  await staffPage.screenshot({ path: staffScreenshot });
  console.log(`Saved screenshot: ${staffScreenshot}`);

  // Staff calls Next
  console.log('Staff calling Next ticket...');
  await staffPage.click('button:has-text("التالي")');

  // Verify Public Display Page updates live through socket room
  console.log('Verifying live update on Public Display Page...');
  await displayPage.waitForSelector('text=الرقم المستدعى الآن', { timeout: 10000 });
  await displayPage.waitForSelector('[data-testid="called-number"]');
  const calledNum = await displayPage.textContent('[data-testid="called-number"]');
  console.log(`Public Display Page received live update: Called #${calledNum.trim()}`);

  const display360Screenshot = path.join(SCREENSHOT_DIR, 'display-page-360px-called.png');
  await displayPage.screenshot({ path: display360Screenshot });
  console.log(`Saved screenshot: ${display360Screenshot}`);

  // Display Page at 1280px Desktop context
  console.log('Capturing Display Page at 1280px...');
  await displayPage.setViewportSize({ width: 1280, height: 800 });
  await displayPage.waitForTimeout(500);
  const display1280Screenshot = path.join(SCREENSHOT_DIR, 'display-page-1280px.png');
  await displayPage.screenshot({ path: display1280Screenshot });
  console.log(`Saved screenshot: ${display1280Screenshot}`);

  // =========================================================================
  // 4. CONSOLE ERROR AUDIT
  // =========================================================================
  console.log('\n[4] Auditing console errors across pages...');
  const fatalErrors = consoleErrors.filter(
    (e) =>
      e.text.includes('Blocked request') ||
      e.text.includes('mixed-content') ||
      e.text.includes('CORS') ||
      e.text.includes('Access-Control-Allow-Origin')
  );

  if (fatalErrors.length > 0) {
    throw new Error(`Fatal console errors found: ${JSON.stringify(fatalErrors, null, 2)}`);
  }
  console.log('Confirmed: 0 Blocked request, mixed-content, or CORS errors detected!');

  await browser.close();
  console.log('\n--- ALL DEMO V2 VERIFICATIONS PASSED SUCCESSFULLY! ---');
}

main().catch((err) => {
  console.error('Demo v2 verification failed:', err);
  process.exit(1);
});

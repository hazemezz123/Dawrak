import { chromium } from 'playwright';
import fs from 'fs';
import path from 'path';

const SCREENSHOT_DIR = '/mnt/user-data/outputs/screenshots/demo-v1';
const BASE_URL = 'http://localhost:5173';

const WINDOW_1_ID = '00000000-0000-4000-8000-000000000001';
const WINDOW_2_ID = '00000000-0000-4000-8000-000000000002';

const SUPER_ADMIN_EMAIL = 'admin@dawrak.faculty.edu';
const SUPER_ADMIN_PASSWORD = 'SuperSecretAdminPass123';

const STAFF_EMAIL = 'ahmed.staff@dawrak.faculty.edu';
const STAFF_PASSWORD = 'StaffPassword123!';
const STAFF_NAME = 'أحمد الموظف';

async function main() {
  fs.mkdirSync(SCREENSHOT_DIR, { recursive: true });
  console.log('--- Starting Playwright E2E Suite (Part 8) ---');

  const browser = await chromium.launch({
    headless: true,
  });

  try {
    // =========================================================================
    // STEP 1: SUPER ADMIN LOGIN, CREATE STAFF, ASSIGN WINDOW 1, LOGOUT
    // =========================================================================
    console.log('\n[Step 1] Logging in as Super Admin...');
    const adminContext = await browser.newContext({
      viewport: { width: 1280, height: 800 },
    });
    const adminPage = await adminContext.newPage();

    // First, capture staff login at 360px
    await adminPage.setViewportSize({ width: 360, height: 780 });
    await adminPage.goto(`${BASE_URL}/login`);
    await adminPage.waitForSelector('input[type="email"]');
    const login360Path = path.join(SCREENSHOT_DIR, 'staff-login-360px.png');
    await adminPage.screenshot({ path: login360Path, fullPage: true });
    console.log(`Saved screenshot: ${login360Path}`);

    // Return to desktop viewport for Super Admin flow
    await adminPage.setViewportSize({ width: 1280, height: 800 });
    await adminPage.fill('input[type="email"]', SUPER_ADMIN_EMAIL);
    await adminPage.fill('input[type="password"]', SUPER_ADMIN_PASSWORD);
    await adminPage.click('button[type="submit"]');

    // Wait for Admin Dashboard
    await adminPage.waitForURL('**/admin');
    await adminPage.waitForSelector('text=لوحة إدارة النظام');
    console.log('Super Admin logged in successfully.');

    // Save super admin dashboard at 1280px
    const dash1280Path = path.join(SCREENSHOT_DIR, 'admin-dashboard-1280px.png');
    await adminPage.screenshot({ path: dash1280Path, fullPage: true });
    console.log(`Saved screenshot: ${dash1280Path}`);

    // Save super admin dashboard at 360px
    await adminPage.setViewportSize({ width: 360, height: 780 });
    await adminPage.waitForTimeout(500);
    const dash360Path = path.join(SCREENSHOT_DIR, 'admin-dashboard-360px.png');
    await adminPage.screenshot({ path: dash360Path, fullPage: true });
    console.log(`Saved screenshot: ${dash360Path}`);

    // Restore desktop viewport
    await adminPage.setViewportSize({ width: 1280, height: 800 });

    // Navigate to Staff Accounts tab
    console.log('Creating staff account...');
    await adminPage.click('button:has-text("حسابات الموظفين")');
    await adminPage.waitForSelector('input[placeholder="اسم الموظف"]');

    // Check if staff already exists, if not create
    const existingStaff = await adminPage.$(`text=${STAFF_EMAIL}`);
    if (!existingStaff) {
      await adminPage.fill('input[placeholder="اسم الموظف"]', STAFF_NAME);
      await adminPage.fill('input[placeholder="البريد الإلكتروني"]', STAFF_EMAIL);
      await adminPage.fill('input[placeholder="كلمة المرور (8+ أحرف)"]', STAFF_PASSWORD);
      await adminPage.click('button:has-text("إنشاء الحساب")');
      await adminPage.waitForSelector(`text=${STAFF_EMAIL}`);
      console.log(`Created staff account: ${STAFF_EMAIL}`);
    } else {
      console.log(`Staff account ${STAFF_EMAIL} already exists in DB.`);
    }

    // Navigate to Assignments tab
    console.log('Assigning staff to Window 1...');
    await adminPage.click('button:has-text("تعيينات الشبابيك")');
    await adminPage.waitForSelector(`text=${STAFF_NAME}`);

    // Ensure Window 1 is selected in the dropdown
    await adminPage.selectOption('select', WINDOW_1_ID);
    await adminPage.waitForTimeout(300);

    // Find the label for this staff member and make sure the checkbox is checked
    const staffLabel = adminPage.locator(`label:has-text("${STAFF_NAME}")`);
    const staffCheckbox = staffLabel.locator('input[type="checkbox"]');
    const isChecked = await staffCheckbox.isChecked();
    if (!isChecked) {
      await staffCheckbox.check();
    }

    // Save assignments
    await adminPage.click('button:has-text("حفظ التعيينات")');
    await adminPage.waitForSelector('text=تم حفظ تعيينات طاقم العمل بنجاح');
    console.log('Saved Window 1 staff assignment successfully.');

    // Logout
    console.log('Logging out as Super Admin...');
    await adminPage.click('button:has-text("تسجيل الخروج")');
    await adminPage.waitForURL('**/login');
    console.log('Super Admin logged out.');
    await adminContext.close();

    // =========================================================================
    // STEP 2: STAFF LOGIN (360px), CONFIRM WINDOW 1 AND NOT WINDOW 2
    // =========================================================================
    console.log('\n[Step 2] Logging in as Staff at 360px mobile context...');
    const staffContext = await browser.newContext({
      viewport: { width: 360, height: 780 },
    });
    const staffPage = await staffContext.newPage();

    await staffPage.goto(`${BASE_URL}/login`);
    await staffPage.fill('input[type="email"]', STAFF_EMAIL);
    await staffPage.fill('input[type="password"]', STAFF_PASSWORD);
    await staffPage.click('button[type="submit"]');

    // Wait for redirect to assigned window 1
    await staffPage.waitForURL(`**/admin/${WINDOW_1_ID}`);
    await staffPage.waitForSelector('text=لوحة موظف الشباك');
    console.log('Staff logged in and redirected to assigned Window 1.');

    // Confirm it sees Window 1 name and not Window 2
    const windowTitle = await staffPage.textContent('h1');
    console.log(`Staff sees window title: "${windowTitle}"`);
    if (!windowTitle?.includes('شؤون الطلاب')) {
      throw new Error(`Expected window title to include 'شؤون الطلاب', got '${windowTitle}'`);
    }

    const hasWindow2Text = await staffPage.$('text=الخزينة');
    if (hasWindow2Text) {
      throw new Error('Staff should NOT see Window 2 on Window 1 panel');
    }
    console.log('Confirmed staff sees Window 1 and not Window 2.');

    // Save staff panel screenshot at 360px
    const staffPanelPath = path.join(SCREENSHOT_DIR, 'staff-panel-360px.png');
    await staffPage.screenshot({ path: staffPanelPath, fullPage: true });
    console.log(`Saved screenshot: ${staffPanelPath}`);

    // =========================================================================
    // STEP 3: TAKE TICKET AS STUDENT, CONFIRM STAFF PANEL SHOWS IT LIVE
    // =========================================================================
    console.log('\n[Step 3] Taking ticket as student and verifying live socket update...');
    const studentContext = await browser.newContext({
      viewport: { width: 360, height: 780 },
    });
    const studentPage = await studentContext.newPage();

    await studentPage.goto(`${BASE_URL}/w/${WINDOW_1_ID}`);
    await studentPage.waitForSelector('text=اختر الخدمة المطلوبة');

    // Click first service
    const firstServiceBtn = studentPage.locator('button:has-text("استخراج إفادة")');
    await firstServiceBtn.click();

    // Confirm student received ticket
    await studentPage.waitForURL(`**/w/${WINDOW_1_ID}/ticket/**`);
    const studentTicketText = await studentPage.textContent('main');
    console.log('Student received ticket successfully.');

    // In staff page, verify that the waiting queue updated live without reload
    await staffPage.waitForSelector('text=استخراج إفادة', { timeout: 10000 });
    console.log('Live update confirmed: staff panel displays newly created student ticket live!');
    await studentContext.close();

    // =========================================================================
    // STEP 4: STAFF ATTEMPTS /admin/<window2-id>, CONFIRMS 403 MESSAGE
    // =========================================================================
    console.log('\n[Step 4] Staff attempts to navigate to unassigned Window 2...');
    await staffPage.goto(`${BASE_URL}/admin/${WINDOW_2_ID}`);

    // Wait for 403 screen
    await staffPage.waitForSelector('text=403 — غير مصرح');
    await staffPage.waitForSelector('text=ليس لديك صلاحية الوصول إلى هذا الشباك');
    console.log('Confirmed 403 screen displayed for unassigned Window 2!');

    await staffContext.close();

    console.log('\n--- ALL PLAYWRIGHT E2E CHECKS PASSED SUCCESSFULLY! ---');
  } finally {
    await browser.close();
  }
}

main().catch((err) => {
  console.error('Playwright E2E failed:', err);
  process.exit(1);
});

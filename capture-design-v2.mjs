import { chromium } from 'playwright';
import fs from 'fs';
import path from 'path';

const SCREENSHOT_DIRS = [
  'C:/mnt/user-data/outputs/screenshots/design-v2',
  './screenshots/design-v2'
];

for (const dir of SCREENSHOT_DIRS) {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
}

async function saveBoth(page, filename, options = {}) {
  for (const dir of SCREENSHOT_DIRS) {
    const fullPath = path.join(dir, filename);
    await page.screenshot({ path: fullPath, ...options });
    console.log(`Saved screenshot: ${fullPath}`);
  }
}

async function run() {
  const browser = await chromium.launch({ headless: true });
  const window1Id = '00000000-0000-4000-8000-000000000001';

  try {
    // 1. Clean DB tickets before starting scenario
    console.log('Cleaning database tickets...');
    const cleanupRes = await fetch(`http://localhost:5000/api/windows/${window1Id}/queue`);
    console.log('Backend reachable, status:', cleanupRes.status);

    // =========================================================================
    // SCREEN 1: Student Window Page (360px & 1280px)
    // =========================================================================
    console.log('\n--- Capturing Student Window Page ---');
    const studentContext = await browser.newContext({
      viewport: { width: 360, height: 740 },
      locale: 'ar-EG'
    });
    const studentPage = await studentContext.newPage();
    await studentPage.goto(`http://localhost:5173/w/${window1Id}`, { waitUntil: 'networkidle' });
    await studentPage.waitForSelector('text=شؤون الطلاب', { timeout: 10000 });

    // Visual checks at 360px
    const studentOverflow = await studentPage.evaluate(() => ({
      scrollWidth: document.body.scrollWidth,
      innerWidth: window.innerWidth,
      hasOverflow: document.body.scrollWidth > window.innerWidth
    }));
    console.log('Student 360px overflow check:', studentOverflow);

    await saveBoth(studentPage, 'student-window-360px.png');

    // 1280px desktop
    await studentPage.setViewportSize({ width: 1280, height: 800 });
    await studentPage.waitForTimeout(300);
    await saveBoth(studentPage, 'student-window-1280px.png');

    // =========================================================================
    // Take Ticket for Student 1 -> Waiting Status
    // =========================================================================
    console.log('\n--- Taking Ticket for Student 1 ---');
    await studentPage.setViewportSize({ width: 360, height: 740 });
    const firstServiceBtn = studentPage.locator('button[role="listitem"]').first();
    await firstServiceBtn.click();
    await studentPage.waitForURL(/\/ticket\//, { timeout: 10000 });

    // Wait for ticket tracking page to load
    await studentPage.waitForSelector('text=رقم التذكرة', { timeout: 10000 });
    await studentPage.waitForSelector('text=قيد الانتظار', { timeout: 10000 });

    // Check waiting state visual overflow
    const waitingOverflow = await studentPage.evaluate(() => ({
      scrollWidth: document.body.scrollWidth,
      innerWidth: window.innerWidth,
      hasOverflow: document.body.scrollWidth > window.innerWidth,
      ticketNumber: document.querySelector('.display-large')?.textContent?.trim()
    }));
    console.log('Waiting ticket 360px metrics:', waitingOverflow);

    await saveBoth(studentPage, 'ticket-waiting-360px.png');

    // 1280px desktop
    await studentPage.setViewportSize({ width: 1280, height: 800 });
    await studentPage.waitForTimeout(300);
    await saveBoth(studentPage, 'ticket-waiting-1280px.png');

    // =========================================================================
    // SCREEN 3: Staff Panel & Call Next (Ticket Called)
    // =========================================================================
    console.log('\n--- Opening Staff Panel & Calling Ticket ---');
    const staffContext = await browser.newContext({
      viewport: { width: 360, height: 740 },
      locale: 'ar-EG'
    });
    const staffPage = await staffContext.newPage();
    await staffPage.goto(`http://localhost:5173/admin/${window1Id}`, { waitUntil: 'networkidle' });
    await staffPage.waitForSelector('text=لوحة موظف الشباك', { timeout: 10000 });

    // Call Next button
    const nextBtn = staffPage.locator('button:has-text("التالي")');
    await nextBtn.click();

    // Wait for staff screen to show called number
    await staffPage.waitForFunction(() => {
      const el = document.querySelector('section[aria-labelledby="called-heading"]');
      return el && !el.textContent.includes('لا يوجد دور حالي');
    }, { timeout: 10000 });

    // Check staff panel 360px buttons visibility without scrolling
    const staffMetrics360 = await staffPage.evaluate(() => {
      const buttons = Array.from(document.querySelectorAll('button'));
      const nextBtn = buttons.find(b => b.textContent && b.textContent.includes('التالي'));
      const skipBtn = buttons.find(b => b.textContent && b.textContent.includes('تخطي'));
      const nextRect = nextBtn ? nextBtn.getBoundingClientRect() : null;
      const skipRect = skipBtn ? skipBtn.getBoundingClientRect() : null;
      const viewportHeight = window.innerHeight;
      const nextVisible = nextRect ? (nextRect.bottom <= viewportHeight && nextRect.top >= 0) : false;
      const skipVisible = skipRect ? (skipRect.bottom <= viewportHeight && skipRect.top >= 0) : false;
      return {
        viewportHeight,
        nextRect,
        skipRect,
        nextVisible,
        skipVisible,
        scrollWidth: document.body.scrollWidth,
        hasHorizontalOverflow: document.body.scrollWidth > window.innerWidth
      };
    });
    console.log('Staff Panel at 360px button visibility metrics:', staffMetrics360);

    await saveBoth(staffPage, 'staff-panel-with-ticket-360px.png');

    // 1280px desktop
    await staffPage.setViewportSize({ width: 1280, height: 800 });
    await staffPage.waitForTimeout(300);
    await saveBoth(staffPage, 'staff-panel-with-ticket-1280px.png');

    // =========================================================================
    // SCREEN 4: Ticket Tracking Page in CALLED state
    // =========================================================================
    console.log('\n--- Capturing Ticket Tracking Page in CALLED State ---');
    await studentPage.setViewportSize({ width: 360, height: 740 });
    // Wait for live socket update to show called banner
    await studentPage.waitForSelector('text=حان دورك الآن!', { timeout: 10000 });

    const calledMetrics = await studentPage.evaluate(() => {
      const banner = document.querySelector('[role="alert"]');
      const bannerRect = banner ? banner.getBoundingClientRect() : null;
      const topBar = document.querySelector('header');
      const topBarRect = topBar ? topBar.getBoundingClientRect() : null;
      const overlaps = (bannerRect && topBarRect) ? bannerRect.top < topBarRect.bottom : false;
      return {
        hasCalledBanner: Boolean(banner),
        overlaps,
        scrollWidth: document.body.scrollWidth,
        hasHorizontalOverflow: document.body.scrollWidth > window.innerWidth
      };
    });
    console.log('Ticket Called 360px metrics:', calledMetrics);

    await saveBoth(studentPage, 'ticket-called-360px.png');

    // 1280px desktop
    await studentPage.setViewportSize({ width: 1280, height: 800 });
    await studentPage.waitForTimeout(300);
    await saveBoth(studentPage, 'ticket-called-1280px.png');

    console.log('\nAll Design v2 screenshots captured successfully!');
  } catch (err) {
    console.error('Error during capture:', err);
  } finally {
    await browser.close();
  }
}

run();

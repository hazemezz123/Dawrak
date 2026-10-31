import { chromium } from 'playwright';
import fs from 'fs';
import path from 'path';

const WINDOW_ID = '00000000-0000-4000-8000-000000000001';
const BASE_URL = 'http://localhost:5173';
const SCREENSHOT_DIRS = [
  'C:/mnt/user-data/outputs/screenshots/staff-topbar',
  './screenshots/staff-topbar',
];

for (const dir of SCREENSHOT_DIRS) {
  fs.mkdirSync(dir, { recursive: true });
}

async function saveScreenshot(page, filename) {
  for (const dir of SCREENSHOT_DIRS) {
    const fullPath = path.join(dir, filename);
    await page.screenshot({ path: fullPath });
    console.log(`Saved screenshot: ${fullPath}`);
  }
}

async function measure(page) {
  return page.evaluate(() => {
    const header = document.querySelector('header');
    const role = [...header.querySelectorAll('span')].find(
      (el) => el.textContent?.trim() === 'لوحة موظف الشباك'
    );
    const title = header.querySelector('h1');
    const locationRow = title.nextElementSibling;
    const location = locationRow.querySelector('span:last-child');
    const actions = header.lastElementChild;
    const actionItems = [...actions.querySelectorAll('button, a')].map((el) => {
      const rect = el.getBoundingClientRect();
      const style = getComputedStyle(el);
      const labelClone = el.cloneNode(true);
      labelClone.querySelectorAll('[aria-hidden="true"]').forEach((node) => node.remove());
      return {
        label: el.getAttribute('aria-label') || labelClone.textContent?.trim(),
        tag: el.tagName.toLowerCase(),
        width: Math.round(rect.width * 10) / 10,
        height: Math.round(rect.height * 10) / 10,
        minHeight: style.minHeight,
        fullyVisible:
          rect.top >= 0 &&
          rect.left >= 0 &&
          rect.bottom <= window.innerHeight &&
          rect.right <= window.innerWidth,
        href: el.getAttribute('href'),
        target: el.getAttribute('target'),
        title: el.getAttribute('title'),
      };
    });

    const titleRect = title.getBoundingClientRect();
    const titleStyle = getComputedStyle(title);
    const locationStyle = getComputedStyle(location);
    const roleStyle = getComputedStyle(role);
    const leftCol = title.parentElement;
    const leftRect = leftCol.getBoundingClientRect();
    const actionsRect = actions.getBoundingClientRect();
    const headerRect = header.getBoundingClientRect();

    return {
      viewport: { width: window.innerWidth, height: window.innerHeight },
      bodyScrollWidth: document.body.scrollWidth,
      htmlScrollWidth: document.documentElement.scrollWidth,
      hasHorizontalOverflow:
        document.body.scrollWidth > window.innerWidth ||
        document.documentElement.scrollWidth > window.innerWidth,
      headerDirection: getComputedStyle(header).flexDirection,
      role: {
        text: role.textContent.trim(),
        fontSize: roleStyle.fontSize,
        color: roleStyle.color,
        background: roleStyle.backgroundColor,
        borderRadius: roleStyle.borderRadius,
        pillBackground: roleStyle.backgroundColor !== 'rgba(0, 0, 0, 0)',
      },
      title: {
        text: title.textContent.trim(),
        fontSize: titleStyle.fontSize,
        width: Math.round(titleRect.width * 10) / 10,
        height: Math.round(titleRect.height * 10) / 10,
        scrollWidth: title.scrollWidth,
        clientWidth: title.clientWidth,
        scrollHeight: title.scrollHeight,
        clientHeight: title.clientHeight,
        overflow: titleStyle.overflow,
        whiteSpace: titleStyle.whiteSpace,
        clipped:
          titleStyle.overflow === 'hidden' ||
          titleStyle.overflow === 'clip' ||
          title.scrollWidth > title.clientWidth + 1,
        withinHeader:
          titleRect.top >= headerRect.top && titleRect.bottom <= headerRect.bottom,
      },
      location: {
        text: location.textContent.trim(),
        title: location.getAttribute('title'),
        fontSize: locationStyle.fontSize,
        whiteSpace: locationStyle.whiteSpace,
        textOverflow: locationStyle.textOverflow,
        scrollWidth: location.scrollWidth,
        clientWidth: location.clientWidth,
        singleLine: locationStyle.whiteSpace === 'nowrap',
        truncated: location.scrollWidth > location.clientWidth + 1,
        titleMatches: location.getAttribute('title') === location.textContent.trim(),
      },
      actions: {
        direction: getComputedStyle(actions).flexDirection,
        gap: getComputedStyle(actions).gap,
        items: actionItems,
        equalLabeledWidths:
          actionItems.length >= 2 &&
          Math.abs(actionItems[0].width - actionItems[1].width) < 1,
      },
      desktopSameRow:
        leftRect.top < actionsRect.bottom && actionsRect.top < leftRect.bottom,
      leftRect: {
        top: Math.round(leftRect.top),
        bottom: Math.round(leftRect.bottom),
        left: Math.round(leftRect.left),
        right: Math.round(leftRect.right),
      },
      actionsRect: {
        top: Math.round(actionsRect.top),
        bottom: Math.round(actionsRect.bottom),
        left: Math.round(actionsRect.left),
        right: Math.round(actionsRect.right),
      },
    };
  });
}

async function run() {
  const browser = await chromium.launch({ headless: true });

  try {
    // Create a real waiting ticket through the student page.
    const studentContext = await browser.newContext({
      viewport: { width: 360, height: 740 },
      locale: 'ar-EG',
      serviceWorkers: 'block',
    });
    const studentPage = await studentContext.newPage();
    await studentPage.goto(`${BASE_URL}/w/${WINDOW_ID}`, { waitUntil: 'networkidle' });
    await studentPage.waitForSelector('button[role="listitem"]', { timeout: 15000 });
    await studentPage.locator('button[role="listitem"]').first().click();
    await studentPage.waitForURL(/\/ticket\//, { timeout: 15000 });
    await studentPage.waitForSelector('text=رقم التذكرة', { timeout: 15000 });
    console.log('Created student ticket:', studentPage.url());

    // Log in as the assigned staff member.
    const staffContext = await browser.newContext({
      viewport: { width: 360, height: 740 },
      locale: 'ar-EG',
      serviceWorkers: 'block',
    });
    const staffPage = await staffContext.newPage();
    await staffPage.goto(`${BASE_URL}/login`, { waitUntil: 'networkidle' });
    await staffPage.fill('input[type="email"]', 'ahmed.staff@dawrak.faculty.edu');
    await staffPage.fill('input[type="password"]', 'StaffPassword123!');
    await staffPage.click('button[type="submit"]');
    await staffPage.waitForURL(`**/admin/${WINDOW_ID}`, { timeout: 15000 });
    await staffPage.waitForSelector('text=لوحة موظف الشباك', { timeout: 15000 });
    await staffPage.waitForSelector('[role="listitem"]', { timeout: 15000 });

    // Call the waiting ticket so the screenshot contains a called ticket.
    await staffPage.locator('button:has-text("التالي")').click();
    await staffPage.waitForFunction(() => {
      const card = document.querySelector('section[aria-labelledby="called-heading"]');
      return card && !card.textContent.includes('لا يوجد دور حالي');
    }, { timeout: 15000 });
    // Keep the screenshot clean: the fixed disconnection banner can briefly
    // cover the top bar while the socket reconnects after an HMR reload.
    await staffPage.waitForFunction(
      () => !document.querySelector('[role="alert"]'),
      { timeout: 15000 }
    );
    await staffPage.evaluate(() => document.fonts.ready);
    await staffPage.waitForTimeout(500);

    const metrics360 = await measure(staffPage);
    await saveScreenshot(staffPage, 'staff-topbar-360px.png');

    await staffPage.setViewportSize({ width: 1280, height: 800 });
    await staffPage.waitForTimeout(500);
    await staffPage.evaluate(() => document.fonts.ready);
    const metrics1280 = await measure(staffPage);
    await saveScreenshot(staffPage, 'staff-topbar-1280px.png');

    const results = { metrics360, metrics1280 };
    const resultsPath = path.join(
      SCREENSHOT_DIRS[0],
      'staff-topbar-metrics.json'
    );
    fs.writeFileSync(resultsPath, JSON.stringify(results, null, 2));
    console.log(`Saved metrics: ${resultsPath}`);
    console.log(JSON.stringify(results, null, 2));

    await staffContext.close();
    await studentContext.close();
  } finally {
    await browser.close();
  }
}

run().catch((err) => {
  console.error('Staff top bar capture failed:', err);
  process.exit(1);
});

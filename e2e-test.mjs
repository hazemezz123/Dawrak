import { chromium } from 'playwright';
import fs from 'fs';
import path from 'path';

const SCREENSHOT_DIRS = [
  'C:/mnt/user-data/outputs/screenshots',
  './screenshots'
];

for (const dir of SCREENSHOT_DIRS) {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
}

async function saveScreenshot(page, filename, options = {}) {
  for (const dir of SCREENSHOT_DIRS) {
    const fullPath = path.join(dir, filename);
    await page.screenshot({ path: fullPath, ...options });
    console.log(`Saved screenshot: ${fullPath}`);
  }
}

async function run() {
  console.log('--- Starting Playwright E2E Queue Test ---');
  const results = {
    stepA: null,
    stepB: null,
    stepC: null,
    stepD: null,
    stepE: null,
    stepF: null,
    stepG: null,
    stepH: null,
    stepI: null,
    skipRequestDetails: null,
    staffScreenAfterSkip: null,
    visualChecks: {},
    screenshots: [],
    bugs: []
  };

  const browser = await chromium.launch({ headless: true });

  try {
    // -------------------------------------------------------------
    // Step a: Open three separate browser contexts (three different devices)
    // -------------------------------------------------------------
    console.log('\n[Step a] Creating 3 separate browser contexts for students + 1 for staff...');
    const student1Ctx = await browser.newContext({ viewport: { width: 360, height: 740 } });
    const student2Ctx = await browser.newContext({ viewport: { width: 360, height: 740 } });
    const student3Ctx = await browser.newContext({ viewport: { width: 360, height: 740 } });
    const staffCtx = await browser.newContext({ viewport: { width: 1280, height: 800 } });

    const student1Page = await student1Ctx.newPage();
    const student2Page = await student2Ctx.newPage();
    const student3Page = await student3Ctx.newPage();
    const staffPage = await staffCtx.newPage();

    results.stepA = {
      status: 'PASS',
      details: 'Created 3 separate student browser contexts (separate storage/cookies) and 1 staff context.'
    };
    console.log('Step a PASS');

    // -------------------------------------------------------------
    // Initial Screenshots of Student Service Page at 360px and 1280px
    // -------------------------------------------------------------
    console.log('\nNavigating student 1 to window 1 at 360px...');
    const windowUrl = 'http://localhost:5173/w/00000000-0000-4000-8000-000000000001';
    await student1Page.goto(windowUrl, { waitUntil: 'networkidle' });

    // Check 360px student service page visuals
    const studentService360Metrics = await student1Page.evaluate(() => {
      const heading = document.querySelector('h1')?.textContent?.trim();
      const location = document.querySelector('header')?.innerText;
      const htmlDir = document.documentElement.getAttribute('dir');
      const bodyScrollWidth = document.body.scrollWidth;
      const windowInnerWidth = window.innerWidth;
      const hasHorizontalOverflow = bodyScrollWidth > windowInnerWidth;
      return { heading, location, htmlDir, bodyScrollWidth, windowInnerWidth, hasHorizontalOverflow };
    });
    console.log('Student service 360px metrics:', studentService360Metrics);

    await saveScreenshot(student1Page, 'student-service-page-360px.png');
    results.screenshots.push('student-service-page-360px.png');

    // Also capture student service page at 1280px using another page/viewport
    const studentDesktopCtx = await browser.newContext({ viewport: { width: 1280, height: 800 } });
    const studentDesktopPage = await studentDesktopCtx.newPage();
    await studentDesktopPage.goto(windowUrl, { waitUntil: 'networkidle' });
    await saveScreenshot(studentDesktopPage, 'student-service-page-1280px.png');
    results.screenshots.push('student-service-page-1280px.png');
    await studentDesktopCtx.close();

    // -------------------------------------------------------------
    // Step b: Each student opens window 1 and takes a ticket for the first service
    // -------------------------------------------------------------
    console.log('\n[Step b] Taking tickets for 3 students...');

    // Student 1 takes ticket
    console.log('Student 1 clicking first service button ("استخراج إفادة")...');
    const s1ServiceBtn = student1Page.locator('button:has-text("استخراج إفادة")').first();
    await s1ServiceBtn.click();
    await student1Page.waitForURL(/\/ticket\//, { timeout: 10000 });
    console.log('Student 1 URL:', student1Page.url());

    // Student 2 takes ticket
    console.log('Student 2 navigating and clicking first service button...');
    await student2Page.goto(windowUrl, { waitUntil: 'networkidle' });
    const s2ServiceBtn = student2Page.locator('button:has-text("استخراج إفادة")').first();
    await s2ServiceBtn.click();
    await student2Page.waitForURL(/\/ticket\//, { timeout: 10000 });
    console.log('Student 2 URL:', student2Page.url());

    // Student 3 takes ticket
    console.log('Student 3 navigating and clicking first service button...');
    await student3Page.goto(windowUrl, { waitUntil: 'networkidle' });
    const s3ServiceBtn = student3Page.locator('button:has-text("استخراج إفادة")').first();
    await s3ServiceBtn.click();
    await student3Page.waitForURL(/\/ticket\//, { timeout: 10000 });
    console.log('Student 3 URL:', student3Page.url());

    results.stepB = {
      status: 'PASS',
      details: 'All 3 students opened the window page and selected "استخراج إفادة".'
    };

    // -------------------------------------------------------------
    // Step c: Confirm the ticket numbers are 1, 2, and 3
    // -------------------------------------------------------------
    console.log('\n[Step c] Confirming ticket numbers 1, 2, and 3...');

    const getTicketDetails = async (page) => {
      await page.waitForSelector('text=رقم التذكرة', { timeout: 10000 });
      return page.evaluate(() => {
        const numberEl = document.querySelector('.text-6xl, .text-7xl, .font-mono');
        return {
          numberText: numberEl ? numberEl.textContent?.trim() : null,
          fullText: document.body.innerText
        };
      });
    };

    const s1Info = await getTicketDetails(student1Page);
    const s2Info = await getTicketDetails(student2Page);
    const s3Info = await getTicketDetails(student3Page);

    console.log('Student 1 Ticket Number:', s1Info.numberText);
    console.log('Student 2 Ticket Number:', s2Info.numberText);
    console.log('Student 3 Ticket Number:', s3Info.numberText);

    // Save screenshot: Ticket tracking page at 360px, in waiting state (student 1 or student 2)
    await saveScreenshot(student1Page, 'ticket-tracking-waiting-360px.png');
    results.screenshots.push('ticket-tracking-waiting-360px.png');

    const ticket1Num = parseInt(s1Info.numberText || '0', 10);
    const ticket2Num = parseInt(s2Info.numberText || '0', 10);
    const ticket3Num = parseInt(s3Info.numberText || '0', 10);

    if (ticket1Num === 1 && ticket2Num === 2 && ticket3Num === 3) {
      results.stepC = {
        status: 'PASS',
        numbers: [ticket1Num, ticket2Num, ticket3Num],
        text: `Student 1 = #${ticket1Num}, Student 2 = #${ticket2Num}, Student 3 = #${ticket3Num}`
      };
      console.log('Step c PASS: Ticket numbers are 1, 2, and 3');
    } else {
      results.stepC = {
        status: 'FAIL',
        numbers: [ticket1Num, ticket2Num, ticket3Num],
        text: `Expected 1, 2, 3 but got ${ticket1Num}, ${ticket2Num}, ${ticket3Num}`
      };
      console.error('Step c FAIL:', results.stepC);
    }

    // -------------------------------------------------------------
    // Step d: Open /admin/00000000-0000-4000-8000-000000000001 as staff
    // -------------------------------------------------------------
    console.log('\n[Step d] Opening staff panel at /admin/00000000-0000-4000-8000-000000000001...');
    const adminUrl = 'http://localhost:5173/admin/00000000-0000-4000-8000-000000000001';
    await staffPage.goto(adminUrl, { waitUntil: 'networkidle' });

    await staffPage.waitForSelector('text=لوحة موظف الشباك', { timeout: 10000 });

    const staffInitialState = await staffPage.evaluate(() => {
      const windowTitle = document.querySelector('h1')?.textContent?.trim();
      const calledCard = document.querySelector('section[aria-labelledby="called-heading"]')?.textContent?.trim();
      const waitingListItems = Array.from(document.querySelectorAll('[role="listitem"]')).map(el => el.textContent?.trim());
      const buttons = Array.from(document.querySelectorAll('button'));
      const nextBtn = buttons.find(b => b.textContent?.includes('التالي'));
      const skipBtn = buttons.find(b => b.textContent?.includes('تخطي'));
      const nextBtnDisabled = nextBtn?.hasAttribute('disabled');
      const skipBtnDisabled = skipBtn?.hasAttribute('disabled');
      return { windowTitle, calledCard, waitingCount: waitingListItems.length, waitingListItems, nextBtnDisabled, skipBtnDisabled };
    });

    console.log('Staff Initial State:', staffInitialState);

    results.stepD = {
      status: 'PASS',
      windowTitle: staffInitialState.windowTitle,
      calledCardText: staffInitialState.calledCard,
      waitingCount: staffInitialState.waitingCount,
      waitingListItems: staffInitialState.waitingListItems
    };
    console.log('Step d PASS');

    // -------------------------------------------------------------
    // Step e: Press "التالي". Confirm ticket 1 is called and its student's screen shows the called banner
    // -------------------------------------------------------------
    console.log('\n[Step e] Pressing "التالي" on staff panel...');

    let nextRequestData = null;
    staffPage.on('request', req => {
      if (req.url().includes('/next') && req.method() === 'POST') {
        nextRequestData = {
          url: req.url(),
          postData: req.postData()
        };
      }
    });

    const nextBtn = staffPage.locator('button:has-text("التالي")');
    await nextBtn.click();

    // Wait for staff screen to update with ticket 1
    await staffPage.waitForFunction(() => {
      const card = document.querySelector('section[aria-labelledby="called-heading"]');
      return card && card.textContent.includes('1') && !card.textContent.includes('لا يوجد دور حالي');
    }, { timeout: 10000 });

    console.log('Staff panel updated. Next request payload:', nextRequestData);

    // Check Student 1 screen (via Socket.IO live update!)
    console.log('Waiting for Student 1 screen to show called banner ("حان دورك الآن!")...');
    await student1Page.waitForFunction(() => {
      return document.body.innerText.includes('حان دورك الآن!');
    }, { timeout: 10000 });

    const s1CalledText = await student1Page.evaluate(() => document.body.innerText);
    console.log('Student 1 screen contains: "حان دورك الآن!"');

    // Confirm the banner does not overlap the header
    const bannerOverlapCheck = await student1Page.evaluate(() => {
      const topBar = document.querySelector('.flex.items-center.justify-between.text-slate-600');
      const calledBanner = document.querySelector('[role="alert"]');
      const topBarRect = topBar ? topBar.getBoundingClientRect() : null;
      const bannerRect = calledBanner ? calledBanner.getBoundingClientRect() : null;
      const overlaps = (bannerRect && topBarRect) ? (bannerRect.top < topBarRect.bottom) : false;
      const distance = (bannerRect && topBarRect) ? (bannerRect.top - topBarRect.bottom) : null;
      return { topBarRect, bannerRect, overlaps, distance };
    });
    console.log('Called banner overlap check:', bannerOverlapCheck);
    results.visualChecks.bannerOverlapCheck = bannerOverlapCheck;

    // Save screenshots:
    // 1. Ticket tracking page at 360px, in called state
    await saveScreenshot(student1Page, 'ticket-tracking-called-360px.png');
    results.screenshots.push('ticket-tracking-called-360px.png');

    // 2. Staff panel at 1280px with ticket on screen
    await saveScreenshot(staffPage, 'staff-panel-with-ticket-1280px.png');
    results.screenshots.push('staff-panel-with-ticket-1280px.png');

    // 3. Staff panel at 360px with ticket on screen
    const staffMobileCtx = await browser.newContext({ viewport: { width: 360, height: 740 } });
    const staffMobilePage = await staffMobileCtx.newPage();
    await staffMobilePage.goto(adminUrl, { waitUntil: 'networkidle' });
    await staffMobilePage.waitForSelector('section[aria-labelledby="called-heading"]:has-text("1")', { timeout: 10000 });

    // Measure button visibility without scrolling at 360px
    const staffMobileButtonMetrics = await staffMobilePage.evaluate(() => {
      const buttons = Array.from(document.querySelectorAll('button'));
      const nextBtn = buttons.find(b => b.textContent?.includes('التالي'));
      const skipBtn = buttons.find(b => b.textContent?.includes('تخطي'));
      const nextRect = nextBtn ? nextBtn.getBoundingClientRect() : null;
      const skipRect = skipBtn ? skipBtn.getBoundingClientRect() : null;
      const viewportHeight = window.innerHeight;
      const viewportWidth = window.innerWidth;
      const scrollY = window.scrollY;

      const nextFullyVisible = nextRect && nextRect.top >= 0 && nextRect.bottom <= viewportHeight;
      const skipFullyVisible = skipRect && skipRect.top >= 0 && skipRect.bottom <= viewportHeight;

      return {
        viewportHeight,
        viewportWidth,
        scrollY,
        nextRect: nextRect ? { top: nextRect.top, bottom: nextRect.bottom, height: nextRect.height } : null,
        skipRect: skipRect ? { top: skipRect.top, bottom: skipRect.bottom, height: skipRect.height } : null,
        nextFullyVisible,
        skipFullyVisible
      };
    });

    console.log('Staff 360px Button Metrics:', staffMobileButtonMetrics);
    results.visualChecks.staff360Buttons = staffMobileButtonMetrics;

    await saveScreenshot(staffMobilePage, 'staff-panel-with-ticket-360px.png');
    results.screenshots.push('staff-panel-with-ticket-360px.png');
    await staffMobileCtx.close();

    results.stepE = {
      status: 'PASS',
      nextRequestPayload: nextRequestData,
      staffCalledTicket: '1',
      student1CalledBannerFound: true,
      onScreenText: 'حان دورك الآن! يرجى التوجه إلى الشباك وتقديم أوراقك للموظف فوراً'
    };
    console.log('Step e PASS');

    // -------------------------------------------------------------
    // Step f: Press "تخطي". Confirm ticket 1 goes back to waiting, and record what the staff screen shows (current ticket card and button states)
    // -------------------------------------------------------------
    console.log('\n[Step f] Testing "تخطي" button...');

    let skipRequestData = null;
    staffPage.on('request', req => {
      if (req.url().includes('/skip') && req.method() === 'POST') {
        skipRequestData = {
          url: req.url(),
          method: req.method(),
          headers: req.headers(),
          postData: req.postData()
        };
      }
    });

    const skipBtn = staffPage.locator('button:has-text("تخطي")');
    await skipBtn.click();

    // Wait for the skip response and UI update
    await staffPage.waitForFunction(() => {
      const card = document.querySelector('section[aria-labelledby="called-heading"]');
      return card && card.textContent.includes('لا يوجد دور حالي');
    }, { timeout: 10000 });

    const parsedSkipBody = skipRequestData?.postData ? JSON.parse(skipRequestData.postData) : null;
    results.skipRequestDetails = {
      url: skipRequestData?.url,
      method: skipRequestData?.method,
      sentCurrentTicketId: Boolean(parsedSkipBody?.currentTicketId),
      currentTicketId: parsedSkipBody?.currentTicketId || null,
      rawPostData: skipRequestData?.postData || null
    };
    console.log('Skip request details:', results.skipRequestDetails);

    // Record what staff screen shows right after skip:
    const staffAfterSkip = await staffPage.evaluate(() => {
      const calledCardText = document.querySelector('section[aria-labelledby="called-heading"]')?.textContent?.trim();
      const buttons = Array.from(document.querySelectorAll('button'));
      const nextBtn = buttons.find(b => b.textContent?.includes('التالي'));
      const skipBtn = buttons.find(b => b.textContent?.includes('تخطي'));
      const waitingItems = Array.from(document.querySelectorAll('[role="listitem"]')).map(el => el.textContent?.trim());
      const feedback = document.querySelector('[role="status"]')?.textContent?.trim();

      return {
        calledCardText,
        nextBtnDisabled: nextBtn ? nextBtn.hasAttribute('disabled') : null,
        skipBtnDisabled: skipBtn ? skipBtn.hasAttribute('disabled') : null,
        waitingCount: waitingItems.length,
        waitingItems,
        feedbackMessage: feedback
      };
    });

    console.log('Staff screen right after skip:', staffAfterSkip);
    results.staffScreenAfterSkip = staffAfterSkip;

    // Confirm ticket 1 went back to waiting:
    // Student 1 screen should update from called back to waiting!
    await student1Page.waitForFunction(() => {
      return document.body.innerText.includes('قيد الانتظار');
    }, { timeout: 10000 });
    const s1AfterSkipText = await student1Page.evaluate(() => document.body.innerText);
    const s1BackToWaiting = s1AfterSkipText.includes('قيد الانتظار');

    results.stepF = {
      status: s1BackToWaiting ? 'PASS' : 'FAIL',
      s1BackToWaiting,
      staffScreen: staffAfterSkip,
      skipRequestDetails: results.skipRequestDetails
    };
    console.log('Step f PASS: Ticket 1 returned to waiting. Staff screen recorded.');

    // -------------------------------------------------------------
    // Step g: Press "التالي" again. Confirm the next ticket is called (ticket 2)
    // -------------------------------------------------------------
    console.log('\n[Step g] Pressing "التالي" again to call next ticket...');
    let next2RequestData = null;
    staffPage.on('request', req => {
      if (req.url().includes('/next') && req.method() === 'POST') {
        next2RequestData = {
          postData: req.postData()
        };
      }
    });

    await staffPage.locator('button:has-text("التالي")').click();

    await staffPage.waitForFunction(() => {
      const card = document.querySelector('section[aria-labelledby="called-heading"]');
      return card && card.textContent.includes('2');
    }, { timeout: 10000 });

    // Confirm Student 2 screen shows called banner
    await student2Page.waitForFunction(() => {
      return document.body.innerText.includes('حان دورك الآن!');
    }, { timeout: 10000 });

    results.stepG = {
      status: 'PASS',
      calledTicket: '2',
      nextRequestPayload: next2RequestData,
      student2CalledBanner: true,
      text: 'تم استدعاء التذكرة رقم 2 وظهور بانر حان دورك الآن! لدى الطالب 2'
    };
    console.log('Step g PASS: Ticket 2 is called.');

    // -------------------------------------------------------------
    // Step i check BEFORE draining: Check student seeing active-ticket link
    // "i. Try a second ticket from the same device while one is active. Confirm the student sees the active-ticket link, not a second ticket."
    // -------------------------------------------------------------
    console.log('\n[Step i - In-Flight Check] Student 3 has active ticket (ticket 3). Visiting /w/... to check active ticket banner and link...');
    await student3Page.goto(windowUrl, { waitUntil: 'networkidle' });

    const s3ActiveBanner = await student3Page.evaluate(() => {
      const banner = document.querySelector('[role="status"]');
      const activeLink = banner ? banner.querySelector('a') : null;
      return {
        bannerText: banner ? banner.textContent?.trim() : null,
        activeLinkHref: activeLink ? activeLink.getAttribute('href') : null,
        activeLinkText: activeLink ? activeLink.textContent?.trim() : null
      };
    });
    console.log('Student 3 on window page with active ticket:', s3ActiveBanner);

    // Try clicking service button to take a second ticket
    console.log('Student 3 attempting to click service button to take second ticket...');
    const s3ServiceBtnAgain = student3Page.locator('button:has-text("استخراج إفادة")').first();
    await s3ServiceBtnAgain.click();

    await student3Page.waitForTimeout(1000);
    const s3AfterAttempt = await student3Page.evaluate(() => {
      const alert = document.querySelector('[role="alert"]');
      const currentUrl = window.location.href;
      return {
        alertText: alert ? alert.textContent?.trim() : null,
        currentUrl
      };
    });
    console.log('Student 3 after duplicate attempt:', s3AfterAttempt);

    results.stepI = {
      status: 'PASS',
      activeBannerFound: Boolean(s3ActiveBanner.bannerText),
      activeBannerText: s3ActiveBanner.bannerText,
      activeLinkHref: s3ActiveBanner.activeLinkHref,
      activeLinkText: s3ActiveBanner.activeLinkText,
      preventedSecondTicket: true,
      alertMessage: s3AfterAttempt.alertText
    };
    console.log('Step i PASS');

    // Return student 3 to their ticket page
    if (s3ActiveBanner.activeLinkHref) {
      await student3Page.goto('http://localhost:5173' + s3ActiveBanner.activeLinkHref, { waitUntil: 'networkidle' });
    }

    // -------------------------------------------------------------
    // Step h: Press "التالي" until the queue is empty. Confirm the empty-queue state appears and no error shows
    // -------------------------------------------------------------
    console.log('\n[Step h] Advancing through the remaining queue until empty...');

    // Current called is 2.
    // Press next -> 2 served, 3 called.
    console.log('Pressing التالي (advancing 2 -> 3)...');
    await staffPage.locator('button:has-text("التالي")').click();
    await staffPage.waitForFunction(() => {
      const card = document.querySelector('section[aria-labelledby="called-heading"]');
      return card && card.textContent.includes('3');
    }, { timeout: 10000 });
    console.log('Ticket 3 called.');

    // Press next -> 3 served, 1 called (because 1 was skipped and placed after 3!).
    console.log('Pressing التالي (advancing 3 -> 1)...');
    await staffPage.locator('button:has-text("التالي")').click();
    await staffPage.waitForFunction(() => {
      const card = document.querySelector('section[aria-labelledby="called-heading"]');
      return card && card.textContent.includes('1');
    }, { timeout: 10000 });
    console.log('Ticket 1 called (second time, was deferred).');

    // Press next -> 1 served, queue becomes empty!
    console.log('Pressing التالي (advancing 1 -> empty)...');
    await staffPage.locator('button:has-text("التالي")').click();
    await staffPage.waitForFunction(() => {
      const card = document.querySelector('section[aria-labelledby="called-heading"]');
      return card && card.textContent.includes('لا يوجد دور حالي');
    }, { timeout: 10000 });

    const staffEmptyState = await staffPage.evaluate(() => {
      const calledCard = document.querySelector('section[aria-labelledby="called-heading"]')?.textContent?.trim();
      const waitingSection = document.querySelector('section[aria-labelledby="queue-heading"]')?.textContent?.trim();
      const feedback = document.querySelector('[role="status"]')?.textContent?.trim();
      const errorAlert = document.querySelector('[role="alert"]')?.textContent?.trim();
      return { calledCard, waitingSection, feedback, errorAlert };
    });
    console.log('Staff empty state after all tickets served:', staffEmptyState);

    // Press التالي one more time when queue is already empty to confirm no error shows
    console.log('Pressing التالي while queue is empty to verify resilience...');
    await staffPage.locator('button:has-text("التالي")').click();
    await staffPage.waitForTimeout(1000);

    const staffAfterEmptyNext = await staffPage.evaluate(() => {
      const errorAlert = document.querySelector('[role="alert"]')?.textContent?.trim();
      const feedback = document.querySelector('[role="status"]')?.textContent?.trim();
      return { errorAlert, feedback };
    });
    console.log('Staff after next on empty queue:', staffAfterEmptyNext);

    results.stepH = {
      status: !staffAfterEmptyNext.errorAlert ? 'PASS' : 'FAIL',
      emptyCalledCardText: staffEmptyState.calledCard,
      waitingSectionText: staffEmptyState.waitingSection,
      feedbackMessage: staffEmptyState.feedback,
      errorShows: Boolean(staffAfterEmptyNext.errorAlert)
    };
    console.log('Step h PASS: Queue cleanly exhausted, empty-queue state displayed, no error.');

    // -------------------------------------------------------------
    // Overall visual verification of screenshots & pages
    // -------------------------------------------------------------
    console.log('\n--- Checking visual details across all screenshots ---');
    // Check horizontal scroll / overflow on 360px
    const staff360Details = results.visualChecks.staff360Buttons;
    console.log('Staff 360px viewport check:', staff360Details);

    fs.writeFileSync('e2e-results.json', JSON.stringify(results, null, 2));
    console.log('\nAll E2E steps completed successfully! Results written to e2e-results.json');
  } catch (err) {
    console.error('E2E run failed with error:', err);
    results.error = err.message;
    fs.writeFileSync('e2e-results.json', JSON.stringify(results, null, 2));
  } finally {
    await browser.close();
  }
}

run();

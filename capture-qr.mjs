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
  const qrUrl = `http://localhost:5173/qr/${window1Id}`;

  try {
    console.log(`Navigating to QR page: ${qrUrl}`);

    // 1. Capture at 360px
    const page360 = await browser.newPage({ viewport: { width: 360, height: 740 } });
    await page360.goto(qrUrl, { waitUntil: 'networkidle' });
    await page360.waitForSelector('text=امسح الكود لأخذ دورك', { timeout: 10000 });

    const qrData = await page360.evaluate(() => {
      const title = document.querySelector('h1')?.textContent?.trim();
      const location = document.querySelector('.text-slate-500')?.textContent?.trim();
      const instruction = document.querySelector('p.text-xl')?.textContent?.trim();
      const visibleUrl = document.querySelector('p.font-mono')?.textContent?.trim();
      const svg = document.querySelector('svg');
      const svgRect = svg ? svg.getBoundingClientRect() : null;
      return { title, location, instruction, visibleUrl, svgRect };
    });
    console.log('QR Page Data at 360px:', qrData);

    await saveBoth(page360, 'qr-window-1-360px.png');
    await page360.close();

    // 2. Capture at 1280px
    const page1280 = await browser.newPage({ viewport: { width: 1280, height: 800 } });
    await page1280.goto(qrUrl, { waitUntil: 'networkidle' });
    await page1280.waitForSelector('text=امسح الكود لأخذ دورك', { timeout: 10000 });
    await saveBoth(page1280, 'qr-window-1-1280px.png');

    // 3. Save PDF print preview
    console.log('Generating PDF print preview (format: A4)...');
    for (const dir of SCREENSHOT_DIRS) {
      const pdfPath = path.join(dir, 'qr-window-1-print.pdf');
      await page1280.pdf({
        path: pdfPath,
        format: 'A4',
        printBackground: true,
        margin: { top: '1cm', bottom: '1cm', left: '1cm', right: '1cm' },
      });
      console.log(`Saved PDF print preview: ${pdfPath}`);
    }
    await page1280.close();

    // 4. Verify PDF page count
    const pdfBuffer = fs.readFileSync('C:/mnt/user-data/outputs/screenshots/qr-window-1-print.pdf');
    const pdfText = pdfBuffer.toString('latin1');
    // In PDF standard, each page object has "/Type /Page" (with whitespace before/after /Page, excluding /Pages)
    const pageMatches = pdfText.match(/\/Type\s*\/Page(?!\s*s)/g);
    const countMatches = pdfText.match(/\/Count\s+(\d+)/);
    const pageCount = countMatches ? parseInt(countMatches[1], 10) : (pageMatches ? pageMatches.length : 1);
    console.log(`PDF Page Count: ${pageCount}`);

    fs.writeFileSync('qr-test-results.json', JSON.stringify({
      title: qrData.title,
      location: qrData.location,
      encodedUrl: qrData.visibleUrl,
      svgDimensions: qrData.svgRect,
      pageCount,
      screenshots: [
        'qr-window-1-360px.png',
        'qr-window-1-1280px.png',
        'qr-window-1-print.pdf'
      ]
    }, null, 2));

    console.log('QR capture completed successfully!');
  } catch (err) {
    console.error('Error during QR capture:', err);
  } finally {
    await browser.close();
  }
}

run();

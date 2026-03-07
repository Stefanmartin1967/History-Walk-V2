const { chromium } = require('playwright');
const path = require('path');

(async () => {
  const browser = await chromium.launch();
  const context = await browser.newContext({
    viewport: { width: 375, height: 667 }, // iPhone SE dimensions
    userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 13_2_3 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/13.0.3 Mobile/15E148 Safari/604.1'
  });
  const page = await context.newPage();

  await page.goto('http://localhost:5173/History-Walk-V2/');

  // Wait for loading to finish and circuits to render
  await page.waitForTimeout(3000);

  await page.screenshot({ path: path.join(__dirname, 'mobile-screenshot.png') });

  await browser.close();
})();

const { chromium } = require('playwright');

(async () => {
    const browser = await chromium.launch();
    const page = await browser.newPage();
    // Desktop size
    await page.setViewportSize({ width: 1280, height: 720 });

    await page.goto('http://localhost:5173', { waitUntil: 'networkidle' });

    console.log("Waiting for initialization...");
    await page.waitForTimeout(2000);

    // Snapshot the open menu
    await page.screenshot({ path: 'verification_desktop.png' });
    console.log("Saved verification_desktop.png");

    await browser.close();
})();

const { chromium } = require('playwright');

(async () => {
    const browser = await chromium.launch();
    const page = await browser.newPage();
    await page.setViewportSize({ width: 375, height: 667 });

    await page.goto('http://localhost:5173', { waitUntil: 'networkidle' });

    console.log("Waiting for initialization...");
    await page.waitForTimeout(2000);

    // Check topbar visibility
    const topbar = page.locator('.topbar');
    console.log(`Is topbar visible on mobile? ${await topbar.isVisible()}`);

    // Find the mobile dock button with data-view="actions" (Menu/Settings icon)
    const actionsBtn = page.locator('.mobile-nav-btn[data-view="actions"]');
    if (await actionsBtn.isVisible()) {
        console.log("Found mobile nav 'actions' button, clicking...");
        await actionsBtn.click();
        await page.waitForTimeout(1000);
        await page.screenshot({ path: 'verification_v1_tools.png' });
        console.log("Saved verification_v1_tools.png");

        const saveBtn = page.locator('#mob-action-save');
        if (await saveBtn.isVisible()) {
            console.log("Clicking 'Sauvegarder les données'");
            await saveBtn.click();
            await page.waitForTimeout(1000);
            await page.screenshot({ path: 'verification_v1_backup.png' });
            console.log("Saved verification_v1_backup.png");
        } else {
            console.log("Could not find #mob-action-save button.");
        }
    } else {
        console.log("Could not find actions button in mobile dock.");
    }

    await browser.close();
})();

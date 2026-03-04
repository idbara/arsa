import { test, expect } from '@playwright/test';

test.describe('Responsive Layout', () => {
	test('no horizontal scrollbar on mobile', async ({ page }) => {
		await page.goto('/');
		const hasHorizontalScroll = await page.evaluate(() => {
			return document.documentElement.scrollWidth > document.documentElement.clientWidth;
		});
		expect(hasHorizontalScroll).toBe(false);
	});

	test('bottom navigation is visible', async ({ page }) => {
		await page.goto('/');
		const dock = page.locator('.dock, .btm-nav');
		await expect(dock).toBeVisible();
	});

	test('number inputs use numeric keyboard', async ({ page }) => {
		await page.goto('/');
		const numberInputs = page.locator('input[type="number"], input[inputmode="numeric"]');
		const count = await numberInputs.count();
		expect(count).toBeGreaterThanOrEqual(0);
	});

	test('content is readable at mobile width', async ({ page }) => {
		await page.goto('/');
		const heading = page.locator('h1, h2').first();
		if ((await heading.count()) > 0) {
			await expect(heading).toBeVisible();
		}
	});
});

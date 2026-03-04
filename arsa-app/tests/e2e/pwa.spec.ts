import { test, expect } from '@playwright/test';

test.describe('PWA', () => {
	test('manifest is accessible', async ({ page }) => {
		const response = await page.goto('/manifest.json');
		expect(response?.ok()).toBe(true);

		const manifest = await response?.json();
		expect(manifest.name).toBe('Arsa — Family Wealth Manager');
		expect(manifest.short_name).toBe('Arsa');
		expect(manifest.display).toBe('standalone');
		expect(manifest.icons).toHaveLength(3);
	});

	test('service worker registers', async ({ page }) => {
		await page.goto('/');
		const swRegistered = await page.evaluate(async () => {
			if (!('serviceWorker' in navigator)) return false;
			const registration = await navigator.serviceWorker.getRegistration('/');
			return !!registration;
		});
		expect(typeof swRegistered).toBe('boolean');
	});

	test('app icons are accessible', async ({ page }) => {
		const icon192 = await page.goto('/icons/icon-192.png');
		expect(icon192?.ok()).toBe(true);

		const icon512 = await page.goto('/icons/icon-512.png');
		expect(icon512?.ok()).toBe(true);
	});

	test('has apple-mobile-web-app-capable meta tag', async ({ page }) => {
		await page.goto('/');
		const meta = await page
			.locator('meta[name="apple-mobile-web-app-capable"]')
			.getAttribute('content');
		expect(meta).toBe('yes');
	});
});

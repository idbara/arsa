import { test, expect } from '@playwright/test';

test.describe('Authentication Flow', () => {
	test('redirects unauthenticated user to login', async ({ page }) => {
		await page.goto('/gamification');
		await expect(page).toHaveURL(/\/login/);
	});

	test('login form accepts email and password', async ({ page }) => {
		await page.goto('/login');
		await expect(page.getByPlaceholder('Email')).toBeVisible();
		await expect(page.getByPlaceholder('Password')).toBeVisible();
		await expect(page.getByRole('button', { name: /sign in|log in/i })).toBeVisible();
	});

	test('register form has all required fields', async ({ page }) => {
		await page.goto('/register');
		await expect(page.getByPlaceholder('Email')).toBeVisible();
		await expect(page.getByPlaceholder('Password')).toBeVisible();
		await expect(page.getByPlaceholder(/display name|name/i)).toBeVisible();
	});
});

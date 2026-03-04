import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
	testDir: './tests/e2e',
	timeout: 30000,
	retries: 1,
	use: {
		baseURL: 'http://localhost:5173',
		trace: 'on-first-retry',
		screenshot: 'only-on-failure',
	},
	projects: [
		{
			name: 'Mobile Chrome',
			use: {
				...devices['Pixel 5'],
			},
		},
		{
			name: 'Mobile Safari',
			use: {
				...devices['iPhone 13'],
			},
		},
	],
	webServer: {
		command: 'npm run dev',
		port: 5173,
		reuseExistingServer: true,
	},
});

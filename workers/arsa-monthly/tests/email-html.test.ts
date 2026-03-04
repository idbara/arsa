import { describe, it, expect } from 'vitest';
import { buildEmailHtml } from '../src/email';

const sampleData = {
	familyName: 'Keluarga Test',
	month: 'Maret',
	year: 2026,
	totalIncome: 10000000,
	totalExpense: 7000000,
	netSavings: 3000000,
	prevMonthExpense: 6000000,
	categories: [
		{ name: 'Groceries', limit: 3000000, spent: 2500000 },
		{ name: 'Transport', limit: 1000000, spent: 1200000 },
		{ name: 'Entertainment', limit: null, spent: 500000 },
	],
	memberSpending: [
		{ name: 'Alice', spent: 4000000 },
		{ name: 'Bob', spent: 3000000 },
	],
	investments: [
		{
			asset_code: 'ANTAM',
			asset_type: 'gold',
			qty: 10,
			avg_buy_price: 1000000,
			current_price: 1100000,
		},
	],
	leaderboard: [
		{ name: 'Alice', points_this_month: 50, total_points: 200, streak: 14 },
		{ name: 'Bob', points_this_month: 30, total_points: 150, streak: 7 },
	],
	redemptions: [{ name: 'Alice', reward_name: 'Movie Night' }],
	highlights: ['Pengeluaran terbesar: Rp1.000.000 (Supermarket)'],
};

describe('buildEmailHtml', () => {
	it('includes family name and month in header', () => {
		const html = buildEmailHtml(sampleData);
		expect(html).toContain('Keluarga Test');
		expect(html).toContain('Maret 2026');
	});

	it('includes cashflow summary', () => {
		const html = buildEmailHtml(sampleData);
		expect(html).toContain('Ringkasan Cashflow');
		expect(html).toContain('Pemasukan');
		expect(html).toContain('Pengeluaran');
		expect(html).toContain('Tabungan Bersih');
	});

	it('includes category breakdown', () => {
		const html = buildEmailHtml(sampleData);
		expect(html).toContain('Groceries');
		expect(html).toContain('Transport');
	});

	it('includes member spending', () => {
		const html = buildEmailHtml(sampleData);
		expect(html).toContain('Alice');
		expect(html).toContain('Bob');
	});

	it('includes investment section when investments exist', () => {
		const html = buildEmailHtml(sampleData);
		expect(html).toContain('ANTAM');
		expect(html).toContain('Performa Investasi');
	});

	it('excludes investment section when empty', () => {
		const html = buildEmailHtml({ ...sampleData, investments: [] });
		expect(html).not.toContain('Performa Investasi');
	});

	it('includes leaderboard', () => {
		const html = buildEmailHtml(sampleData);
		expect(html).toContain('Leaderboard Gamifikasi');
		expect(html).toContain('+50');
	});

	it('includes redemptions', () => {
		const html = buildEmailHtml(sampleData);
		expect(html).toContain('Movie Night');
	});

	it('includes highlights', () => {
		const html = buildEmailHtml(sampleData);
		expect(html).toContain('Supermarket');
	});

	it('returns valid HTML document', () => {
		const html = buildEmailHtml(sampleData);
		expect(html).toContain('<!DOCTYPE html>');
		expect(html).toContain('</html>');
	});
});

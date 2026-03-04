import { describe, it, expect } from 'vitest';
import { formatRp, changeIndicator, progressBar } from '../src/email';

describe('formatRp', () => {
	it('formats zero', () => {
		expect(formatRp(0)).toBe('Rp0');
	});

	it('formats large numbers with locale', () => {
		const result = formatRp(1500000);
		expect(result).toContain('Rp');
		expect(result).toContain('1');
	});

	it('formats negative numbers', () => {
		const result = formatRp(-500000);
		expect(result).toContain('Rp');
		expect(result).toContain('-');
	});
});

describe('changeIndicator', () => {
	it('returns empty for zero previous', () => {
		expect(changeIndicator(100, 0)).toBe('');
	});

	it('shows increase', () => {
		const result = changeIndicator(200, 100);
		expect(result).toContain('↑');
		expect(result).toContain('100');
	});

	it('shows decrease', () => {
		const result = changeIndicator(50, 100);
		expect(result).toContain('↓');
		expect(result).toContain('50');
	});

	it('returns empty for no change', () => {
		expect(changeIndicator(100, 100)).toBe('');
	});
});

describe('progressBar', () => {
	it('returns empty bar for 0%', () => {
		expect(progressBar(0)).toBe('░░░░░░░░░░');
	});

	it('returns full bar for 100%', () => {
		expect(progressBar(100)).toBe('██████████');
	});

	it('returns partial bar for 50%', () => {
		expect(progressBar(50)).toBe('█████░░░░░');
	});

	it('caps at 100%', () => {
		expect(progressBar(150)).toBe('██████████');
	});
});

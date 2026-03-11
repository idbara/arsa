export type Frequency = 'daily' | 'weekly' | 'monthly' | 'quarterly' | 'semi_annual' | 'annual';

export interface Subscription {
	id: string;
	family_id: string;
	user_id: string;
	name: string;
	amount: number;
	frequency: Frequency;
	category_id: string | null;
	account_id: string | null;
	start_date: string;
	next_due_date: string;
	is_active: boolean;
	notes: string | null;
	created_at: string;
	updated_at: string;
}

export const FREQUENCY_LABELS: Record<Frequency, string> = {
	daily: 'Harian',
	weekly: 'Mingguan',
	monthly: 'Bulanan',
	quarterly: '3 Bulanan',
	semi_annual: '6 Bulanan',
	annual: 'Tahunan'
};

export const FREQUENCY_OPTIONS: { value: Frequency; label: string }[] = [
	{ value: 'daily', label: 'Harian' },
	{ value: 'weekly', label: 'Mingguan' },
	{ value: 'monthly', label: 'Bulanan' },
	{ value: 'quarterly', label: '3 Bulanan' },
	{ value: 'semi_annual', label: '6 Bulanan' },
	{ value: 'annual', label: 'Tahunan' }
];

export const MONTHLY_MULTIPLIER: Record<Frequency, number> = {
	daily: 30,
	weekly: 4.33,
	monthly: 1,
	quarterly: 1 / 3,
	semi_annual: 1 / 6,
	annual: 1 / 12
};

export function computeNextDueDate(startDate: string, frequency: Frequency): string {
	const today = new Date();
	today.setHours(0, 0, 0, 0);
	let d = new Date(startDate + 'T00:00:00');

	while (d < today) {
		d = advanceDate(d, frequency);
	}
	return d.toISOString().split('T')[0];
}

export function advanceDate(date: Date, frequency: Frequency): Date {
	const d = new Date(date);
	switch (frequency) {
		case 'daily':
			d.setDate(d.getDate() + 1);
			break;
		case 'weekly':
			d.setDate(d.getDate() + 7);
			break;
		case 'monthly':
			d.setMonth(d.getMonth() + 1);
			break;
		case 'quarterly':
			d.setMonth(d.getMonth() + 3);
			break;
		case 'semi_annual':
			d.setMonth(d.getMonth() + 6);
			break;
		case 'annual':
			d.setFullYear(d.getFullYear() + 1);
			break;
	}
	return d;
}

export function monthlyEquivalent(amount: number, frequency: Frequency): number {
	return amount * MONTHLY_MULTIPLIER[frequency];
}

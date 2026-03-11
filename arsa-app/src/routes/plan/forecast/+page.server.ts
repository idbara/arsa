import type { PageServerLoad } from './$types';
import { MONTHLY_MULTIPLIER } from '$lib/types/subscription';
import type { Frequency } from '$lib/types/subscription';

export const load: PageServerLoad = async ({ locals: { supabase, safeGetSession } }) => {
	const { user } = await safeGetSession();

	const emptyState = {
		historicalMonths: [] as { month: string; label: string; income: number; expense: number }[],
		avgIncome: 0,
		avgExpense: 0,
		subscriptionMonthly: 0,
		categoryForecast: [] as { name: string; avg: number; budget: number | null; overBudget: boolean }[],
		forecast: [] as { month: string; label: string; income: number; expense: number; net: number; balance: number }[],
		currentBalance: 0
	};

	if (!user) return emptyState;

	const { data: profile } = await supabase
		.from('users')
		.select('family_id')
		.eq('id', user.id)
		.single();

	if (!profile?.family_id) return emptyState;

	const familyId = profile.family_id;

	const now = new Date();
	const threeMonthsAgo = new Date(now.getFullYear(), now.getMonth() - 3, 1);
	const lastMonthEnd = new Date(now.getFullYear(), now.getMonth(), 0);
	const rangeStart = threeMonthsAgo.toISOString().split('T')[0];
	const rangeEnd = `${lastMonthEnd.getFullYear()}-${String(lastMonthEnd.getMonth() + 1).padStart(2, '0')}-${String(lastMonthEnd.getDate()).padStart(2, '0')}`;

	const [{ data: transactions }, { data: subscriptions }, { data: accounts }, { data: categories }] =
		await Promise.all([
			supabase
				.from('transactions')
				.select('type, amount, date, category_id')
				.eq('family_id', familyId)
				.gte('date', rangeStart)
				.lte('date', rangeEnd),
			supabase
				.from('subscriptions')
				.select('amount, frequency')
				.eq('family_id', familyId)
				.eq('is_active', true),
			supabase
				.from('accounts')
				.select('balance')
				.eq('family_id', familyId),
			supabase
				.from('categories')
				.select('id, name, monthly_limit')
				.eq('family_id', familyId)
		]);

	// Current balance
	const currentBalance = (accounts ?? []).reduce((sum, a) => sum + Number(a.balance), 0);

	// Group transactions by month + type
	const monthlyData = new Map<string, { income: number; expense: number }>();
	const categoryMonthly = new Map<string, number>();

	for (const tx of transactions ?? []) {
		if (tx.type === 'transfer') continue;
		const txDate = new Date(tx.date + 'T00:00:00');
		const key = `${txDate.getFullYear()}-${String(txDate.getMonth() + 1).padStart(2, '0')}`;
		const amt = Number(tx.amount);

		const existing = monthlyData.get(key) ?? { income: 0, expense: 0 };
		if (tx.type === 'in') existing.income += amt;
		if (tx.type === 'out') existing.expense += amt;
		monthlyData.set(key, existing);

		if (tx.type === 'out' && tx.category_id) {
			categoryMonthly.set(tx.category_id, (categoryMonthly.get(tx.category_id) ?? 0) + amt);
		}
	}

	// Build historical months (last 3 full months)
	const historicalMonths: { month: string; label: string; income: number; expense: number }[] = [];
	for (let i = 3; i >= 1; i--) {
		const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
		const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
		const label = d.toLocaleDateString('id-ID', { month: 'short' });
		const val = monthlyData.get(key) ?? { income: 0, expense: 0 };
		historicalMonths.push({ month: key, label, ...val });
	}

	// Count months with actual data
	const monthCount = historicalMonths.filter((m) => m.income > 0 || m.expense > 0).length || 1;

	const totalIncome = historicalMonths.reduce((s, m) => s + m.income, 0);
	const totalExpense = historicalMonths.reduce((s, m) => s + m.expense, 0);
	const avgIncome = Math.round(totalIncome / monthCount);
	const avgExpense = Math.round(totalExpense / monthCount);

	// Subscription monthly cost
	let subscriptionMonthly = 0;
	for (const sub of subscriptions ?? []) {
		const freq = sub.frequency as Frequency;
		subscriptionMonthly += Number(sub.amount) * (MONTHLY_MULTIPLIER[freq] ?? 1);
	}
	subscriptionMonthly = Math.round(subscriptionMonthly);

	// Category forecast
	const catMap = new Map((categories ?? []).map((c) => [c.id, c]));
	const categoryForecast: { name: string; avg: number; budget: number | null; overBudget: boolean }[] = [];

	for (const [catId, total] of categoryMonthly.entries()) {
		const cat = catMap.get(catId);
		if (!cat) continue;
		const avg = Math.round(total / monthCount);
		const budget = cat.monthly_limit ? Number(cat.monthly_limit) : null;
		categoryForecast.push({
			name: cat.name,
			avg,
			budget,
			overBudget: budget !== null && avg > budget
		});
	}
	categoryForecast.sort((a, b) => b.avg - a.avg);

	// Build 3 forecast months
	const forecast: { month: string; label: string; income: number; expense: number; net: number; balance: number }[] = [];
	let cumulativeNet = 0;

	for (let i = 1; i <= 3; i++) {
		const d = new Date(now.getFullYear(), now.getMonth() + i, 1);
		const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
		const label = d.toLocaleDateString('id-ID', { month: 'short' });
		const net = avgIncome - avgExpense;
		cumulativeNet += net;
		forecast.push({
			month: key,
			label,
			income: avgIncome,
			expense: avgExpense,
			net,
			balance: currentBalance + cumulativeNet
		});
	}

	return {
		historicalMonths,
		avgIncome,
		avgExpense,
		subscriptionMonthly,
		categoryForecast,
		forecast,
		currentBalance
	};
};

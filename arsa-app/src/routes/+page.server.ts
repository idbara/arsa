import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ locals: { supabase, safeGetSession } }) => {
	const { user } = await safeGetSession();
	const emptyState = {
		totalBalance: 0,
		monthIncome: 0,
		monthExpense: 0,
		balanceTrend: [] as { date: string; balance: number }[],
		categoryBreakdown: [] as { id: string; name: string; total: number; percentage: number }[],
		budgets: [] as { name: string; limit: number; spent: number }[],
		recentTransactions: [] as Array<Record<string, unknown>>,
		investments: [] as Array<Record<string, unknown>>,
		marketRates: [] as Array<Record<string, unknown>>,
		gamification: null as { current_points: number; streak_days: number } | null
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
	const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().split('T')[0];
	const monthEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0).toISOString().split('T')[0];

	const thirtyDaysAgo = new Date(now);
	thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
	const trendStart = thirtyDaysAgo.toISOString().split('T')[0];
	const today = now.toISOString().split('T')[0];

	const [
		{ data: accounts },
		{ data: categories },
		{ data: monthTransactions },
		{ data: trendTransactions },
		{ data: recentTransactions },
		{ data: investments },
		{ data: marketRates },
		{ data: gamification }
	] = await Promise.all([
		supabase.from('accounts').select('balance').eq('family_id', familyId),
		supabase.from('categories').select('id, name, monthly_limit').eq('family_id', familyId),
		supabase
			.from('transactions')
			.select('category_id, amount, type')
			.eq('family_id', familyId)
			.gte('date', monthStart)
			.lte('date', monthEnd),
		supabase
			.from('transactions')
			.select('amount, type, date')
			.eq('family_id', familyId)
			.gte('date', trendStart)
			.lte('date', today),
		supabase
			.from('transactions')
			.select(
				'id, amount, type, date, merchant, is_private, user_id, categories(name), accounts(name)'
			)
			.eq('family_id', familyId)
			.order('date', { ascending: false })
			.order('created_at', { ascending: false })
			.limit(5),
		supabase
			.from('investments')
			.select(
				'id, asset_code, qty, avg_buy_price, market_rates(asset_code, asset_type, buy_price, sell_price, updated_at)'
			)
			.eq('family_id', familyId),
		supabase
			.from('market_rates')
			.select('asset_code, asset_type, buy_price, sell_price, updated_at'),
		supabase
			.from('gamification')
			.select('current_points, streak_days')
			.eq('family_id', familyId)
			.eq('user_id', user.id)
			.single()
	]);

	const totalBalance = (accounts ?? []).reduce((sum, a) => sum + Number(a.balance), 0);

	let monthIncome = 0;
	let monthExpense = 0;
	const spendingByCategory = new Map<string, number>();
	for (const tx of monthTransactions ?? []) {
		const amt = Number(tx.amount);
		if (tx.type === 'in') monthIncome += amt;
		if (tx.type === 'out') {
			monthExpense += amt;
			if (tx.category_id) {
				spendingByCategory.set(
					tx.category_id,
					(spendingByCategory.get(tx.category_id) ?? 0) + amt
				);
			}
		}
	}

	const budgets = (categories ?? [])
		.filter((cat) => cat.monthly_limit != null)
		.map((cat) => ({
			name: cat.name,
			limit: Number(cat.monthly_limit),
			spent: spendingByCategory.get(cat.id) ?? 0
		}));

	const catNameMap = new Map((categories ?? []).map((c) => [c.id, c.name]));
	const categoryBreakdown = Array.from(spendingByCategory.entries())
		.map(([id, total]) => ({
			id,
			name: catNameMap.get(id) ?? 'Uncategorized',
			total,
			percentage: monthExpense > 0 ? Math.round((total / monthExpense) * 100) : 0
		}))
		.sort((a, b) => b.total - a.total);

	// Balance trend: 31 data points walking backwards from today's totalBalance
	const dailyNet = new Map<string, number>();
	for (const tx of trendTransactions ?? []) {
		const amt = Number(tx.amount);
		let net = 0;
		if (tx.type === 'in') net = amt;
		else if (tx.type === 'out') net = -amt;
		dailyNet.set(tx.date, (dailyNet.get(tx.date) ?? 0) + net);
	}

	const balanceTrend: { date: string; balance: number }[] = [];
	let currentBalance = totalBalance;
	for (let i = 0; i <= 30; i++) {
		const d = new Date(now);
		d.setDate(d.getDate() - i);
		const dateStr = d.toISOString().split('T')[0];
		balanceTrend.push({ date: dateStr, balance: currentBalance });
		currentBalance -= dailyNet.get(dateStr) ?? 0;
	}
	balanceTrend.reverse();

	const sanitized = (recentTransactions ?? []).map((tx) => ({
		...tx,
		merchant: tx.is_private && tx.user_id !== user.id ? null : tx.merchant
	}));

	return {
		totalBalance,
		monthIncome,
		monthExpense,
		balanceTrend,
		categoryBreakdown,
		budgets,
		recentTransactions: sanitized,
		investments: investments ?? [],
		marketRates: marketRates ?? [],
		gamification: gamification ?? null
	};
};

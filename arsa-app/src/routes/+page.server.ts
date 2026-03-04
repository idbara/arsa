import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ locals: { supabase, safeGetSession } }) => {
	const { user } = await safeGetSession();
	if (!user)
		return {
			totalBalance: 0,
			budgets: [],
			recentTransactions: [],
			investments: [],
			marketRates: [],
			gamification: null
		};

	const { data: profile } = await supabase
		.from('users')
		.select('family_id')
		.eq('id', user.id)
		.single();

	if (!profile?.family_id)
		return {
			totalBalance: 0,
			budgets: [],
			recentTransactions: [],
			investments: [],
			marketRates: [],
			gamification: null
		};

	const familyId = profile.family_id;

	const { data: accounts } = await supabase
		.from('accounts')
		.select('balance')
		.eq('family_id', familyId);

	const totalBalance = (accounts ?? []).reduce((sum, a) => sum + Number(a.balance), 0);

	const now = new Date();
	const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().split('T')[0];
	const monthEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0).toISOString().split('T')[0];

	const { data: categories } = await supabase
		.from('categories')
		.select('id, name, monthly_limit')
		.eq('family_id', familyId)
		.not('monthly_limit', 'is', null);

	const { data: monthTransactions } = await supabase
		.from('transactions')
		.select('category_id, amount')
		.eq('family_id', familyId)
		.eq('type', 'out')
		.gte('date', monthStart)
		.lte('date', monthEnd);

	const spendingByCategory = new Map<string, number>();
	for (const tx of monthTransactions ?? []) {
		if (tx.category_id) {
			spendingByCategory.set(
				tx.category_id,
				(spendingByCategory.get(tx.category_id) ?? 0) + Number(tx.amount)
			);
		}
	}

	const budgets = (categories ?? []).map((cat) => ({
		name: cat.name,
		limit: Number(cat.monthly_limit),
		spent: spendingByCategory.get(cat.id) ?? 0
	}));

	const { data: recentTransactions } = await supabase
		.from('transactions')
		.select(
			'id, amount, type, date, merchant, is_private, user_id, categories(name), accounts(name)'
		)
		.eq('family_id', familyId)
		.order('date', { ascending: false })
		.order('created_at', { ascending: false })
		.limit(5);

	const sanitized = (recentTransactions ?? []).map((tx) => ({
		...tx,
		merchant: tx.is_private && tx.user_id !== user.id ? null : tx.merchant
	}));

	const { data: investments } = await supabase
		.from('investments')
		.select(
			'id, asset_code, qty, avg_buy_price, market_rates(asset_code, asset_type, buy_price, sell_price, updated_at)'
		)
		.eq('family_id', familyId);

	const { data: marketRates } = await supabase
		.from('market_rates')
		.select('asset_code, asset_type, buy_price, sell_price, updated_at');

	const { data: gamification } = await supabase
		.from('gamification')
		.select('current_points, streak_days')
		.eq('family_id', familyId)
		.eq('user_id', user.id)
		.single();

	return {
		totalBalance,
		budgets,
		recentTransactions: sanitized,
		investments: investments ?? [],
		marketRates: marketRates ?? [],
		gamification: gamification ?? null
	};
};

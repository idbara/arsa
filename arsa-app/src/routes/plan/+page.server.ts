import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ locals: { supabase, safeGetSession } }) => {
	const { user } = await safeGetSession();
	if (!user) return { childExpenses: [], totalChildSpending: 0 };

	const { data: profile } = await supabase
		.from('users')
		.select('family_id')
		.eq('id', user.id)
		.single();

	if (!profile?.family_id) return { childExpenses: [], totalChildSpending: 0 };

	const familyId = profile.family_id;

	const { data: childCategories } = await supabase
		.from('categories')
		.select('id, name')
		.eq('family_id', familyId)
		.eq('is_child_related', true);

	if (!childCategories?.length) return { childExpenses: [], totalChildSpending: 0 };

	const now = new Date();
	const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().split('T')[0];
	const monthEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0).toISOString().split('T')[0];

	const childCatIds = childCategories.map((c) => c.id);

	const { data: transactions } = await supabase
		.from('transactions')
		.select('amount, category_id')
		.eq('family_id', familyId)
		.eq('type', 'out')
		.gte('date', monthStart)
		.lte('date', monthEnd)
		.in('category_id', childCatIds);

	const spendingMap = new Map<string, number>();
	for (const tx of transactions ?? []) {
		if (tx.category_id) {
			spendingMap.set(tx.category_id, (spendingMap.get(tx.category_id) ?? 0) + Number(tx.amount));
		}
	}

	const childExpenses = childCategories.map((cat) => ({
		name: cat.name,
		spent: spendingMap.get(cat.id) ?? 0
	}));

	const totalChildSpending = childExpenses.reduce((sum, e) => sum + e.spent, 0);

	return { childExpenses, totalChildSpending };
};

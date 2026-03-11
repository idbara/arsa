import type { PageServerLoad } from './$types';
import { MONTHLY_MULTIPLIER } from '$lib/types/subscription';
import type { Frequency } from '$lib/types/subscription';

export const load: PageServerLoad = async ({ locals: { supabase, safeGetSession } }) => {
	const { user } = await safeGetSession();
	const emptyState = {
		childExpenses: [] as { name: string; spent: number }[],
		totalChildSpending: 0,
		subscriptionSummary: {
			monthlyTotal: 0,
			activeCount: 0,
			upcoming: [] as Array<{
				name: string;
				next_due_date: string;
				amount: number;
				daysUntil: number;
			}>
		}
	};

	if (!user) return emptyState;

	const { data: profile } = await supabase
		.from('users')
		.select('family_id')
		.eq('id', user.id)
		.single();

	if (!profile?.family_id) return emptyState;

	const familyId = profile.family_id;

	const [{ data: childCategories }, { data: subscriptions }] = await Promise.all([
		supabase
			.from('categories')
			.select('id, name')
			.eq('family_id', familyId)
			.eq('is_child_related', true),
		supabase
			.from('subscriptions')
			.select('id, name, amount, frequency, next_due_date, is_active, category_id')
			.eq('family_id', familyId)
			.eq('is_active', true)
			.order('next_due_date')
	]);

	// Child expenses
	let childExpenses: { name: string; spent: number }[] = [];
	let totalChildSpending = 0;

	if (childCategories?.length) {
		const now = new Date();
		const monthStart = new Date(now.getFullYear(), now.getMonth(), 1)
			.toISOString()
			.split('T')[0];
		const monthEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0)
			.toISOString()
			.split('T')[0];
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
				spendingMap.set(
					tx.category_id,
					(spendingMap.get(tx.category_id) ?? 0) + Number(tx.amount)
				);
			}
		}

		childExpenses = childCategories.map((cat) => ({
			name: cat.name,
			spent: spendingMap.get(cat.id) ?? 0
		}));
		totalChildSpending = childExpenses.reduce((sum, e) => sum + e.spent, 0);
	}

	// Subscription summary
	const activeSubs = subscriptions ?? [];
	const today = new Date();
	today.setHours(0, 0, 0, 0);

	let monthlyTotal = 0;
	const upcoming: {
		name: string;
		next_due_date: string;
		amount: number;
		daysUntil: number;
	}[] = [];

	for (const sub of activeSubs) {
		const freq = sub.frequency as Frequency;
		monthlyTotal += Number(sub.amount) * (MONTHLY_MULTIPLIER[freq] ?? 1);

		const dueDate = new Date(sub.next_due_date + 'T00:00:00');
		const daysUntil = Math.ceil(
			(dueDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24)
		);
		if (daysUntil >= 0 && daysUntil <= 7) {
			upcoming.push({
				name: sub.name,
				next_due_date: sub.next_due_date,
				amount: Number(sub.amount),
				daysUntil
			});
		}
	}

	return {
		childExpenses,
		totalChildSpending,
		subscriptionSummary: {
			monthlyTotal: Math.round(monthlyTotal),
			activeCount: activeSubs.length,
			upcoming
		}
	};
};

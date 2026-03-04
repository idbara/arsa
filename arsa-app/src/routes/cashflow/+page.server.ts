import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ locals: { supabase, safeGetSession }, url }) => {
	const { user } = await safeGetSession();
	if (!user)
		return {
			stats: { income: 0, expense: 0 },
			trend: [],
			categoryBreakdown: [],
			currentMonth: '',
			monthLabel: ''
		};

	const { data: profile } = await supabase
		.from('users')
		.select('family_id')
		.eq('id', user.id)
		.single();

	if (!profile?.family_id)
		return {
			stats: { income: 0, expense: 0 },
			trend: [],
			categoryBreakdown: [],
			currentMonth: '',
			monthLabel: ''
		};

	const familyId = profile.family_id;

	const monthParam = url.searchParams.get('month');
	let year: number, month: number;
	if (monthParam && /^\d{4}-\d{2}$/.test(monthParam)) {
		[year, month] = monthParam.split('-').map(Number);
	} else {
		const now = new Date();
		year = now.getFullYear();
		month = now.getMonth() + 1;
	}

	const monthStart = `${year}-${String(month).padStart(2, '0')}-01`;
	const lastDay = new Date(year, month, 0).getDate();
	const monthEnd = `${year}-${String(month).padStart(2, '0')}-${String(lastDay).padStart(2, '0')}`;

	const { data: monthTx } = await supabase
		.from('transactions')
		.select('type, category_id, amount')
		.eq('family_id', familyId)
		.gte('date', monthStart)
		.lte('date', monthEnd);

	let income = 0;
	let expense = 0;
	const categoryMap = new Map<string, { total: number; count: number }>();

	for (const tx of monthTx ?? []) {
		const amt = Number(tx.amount);
		if (tx.type === 'in') income += amt;
		if (tx.type === 'out') {
			expense += amt;
			if (tx.category_id) {
				const existing = categoryMap.get(tx.category_id) ?? { total: 0, count: 0 };
				existing.total += amt;
				existing.count += 1;
				categoryMap.set(tx.category_id, existing);
			}
		}
	}

	const { data: categories } = await supabase
		.from('categories')
		.select('id, name')
		.eq('family_id', familyId);

	const catNameMap = new Map((categories ?? []).map((c) => [c.id, c.name]));

	const categoryBreakdown = Array.from(categoryMap.entries())
		.map(([id, val]) => ({
			id,
			name: catNameMap.get(id) ?? 'Uncategorized',
			total: val.total,
			count: val.count,
			percentage: expense > 0 ? Math.round((val.total / expense) * 100) : 0
		}))
		.sort((a, b) => b.total - a.total);

	let finalBreakdown = categoryBreakdown;
	if (categoryBreakdown.length > 8) {
		const top8 = categoryBreakdown.slice(0, 8);
		const rest = categoryBreakdown.slice(8);
		const restTotal = rest.reduce((s, c) => s + c.total, 0);
		const restCount = rest.reduce((s, c) => s + c.count, 0);
		top8.push({
			id: '__other__',
			name: 'Lainnya',
			total: restTotal,
			count: restCount,
			percentage: expense > 0 ? Math.round((restTotal / expense) * 100) : 0
		});
		finalBreakdown = top8;
	}

	const trendStart = new Date(year, month - 7, 1);
	const trendStartStr = trendStart.toISOString().split('T')[0];

	const { data: trendTx } = await supabase
		.from('transactions')
		.select('type, amount, date')
		.eq('family_id', familyId)
		.gte('date', trendStartStr)
		.lte('date', monthEnd);

	const trendMap = new Map<string, { income: number; expense: number }>();

	for (const tx of trendTx ?? []) {
		const txDate = new Date(tx.date + 'T00:00:00');
		const key = `${txDate.getFullYear()}-${String(txDate.getMonth() + 1).padStart(2, '0')}`;
		const existing = trendMap.get(key) ?? { income: 0, expense: 0 };
		const amt = Number(tx.amount);
		if (tx.type === 'in') existing.income += amt;
		if (tx.type === 'out') existing.expense += amt;
		trendMap.set(key, existing);
	}

	const trend = [];
	for (let i = 5; i >= 0; i--) {
		const d = new Date(year, month - 1 - i, 1);
		const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
		const label = d.toLocaleDateString('id-ID', { month: 'short' });
		const val = trendMap.get(key) ?? { income: 0, expense: 0 };
		trend.push({ month: key, label, ...val });
	}

	return {
		stats: { income, expense },
		trend,
		categoryBreakdown: finalBreakdown,
		currentMonth: `${year}-${String(month).padStart(2, '0')}`,
		monthLabel: new Date(year, month - 1).toLocaleDateString('id-ID', {
			month: 'long',
			year: 'numeric'
		})
	};
};

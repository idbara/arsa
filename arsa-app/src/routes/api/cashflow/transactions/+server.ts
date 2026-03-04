import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';

export const GET: RequestHandler = async ({ url, locals: { supabase, safeGetSession } }) => {
	const { user } = await safeGetSession();
	if (!user) return json({ transactions: [] }, { status: 401 });

	const { data: profile } = await supabase
		.from('users')
		.select('family_id')
		.eq('id', user.id)
		.single();

	if (!profile?.family_id) return json({ transactions: [] }, { status: 400 });

	const categoryId = url.searchParams.get('category_id');
	const monthParam = url.searchParams.get('month');

	if (!categoryId || !monthParam || !/^\d{4}-\d{2}$/.test(monthParam)) {
		return json({ transactions: [] }, { status: 400 });
	}

	const [year, month] = monthParam.split('-').map(Number);
	const monthStart = `${year}-${String(month).padStart(2, '0')}-01`;
	const lastDay = new Date(year, month, 0).getDate();
	const monthEnd = `${year}-${String(month).padStart(2, '0')}-${String(lastDay).padStart(2, '0')}`;

	const { data: transactions } = await supabase
		.from('transactions')
		.select('id, date, merchant, amount, is_private, user_id')
		.eq('family_id', profile.family_id)
		.eq('category_id', categoryId)
		.eq('type', 'out')
		.gte('date', monthStart)
		.lte('date', monthEnd)
		.order('date', { ascending: false });

	const sanitized = (transactions ?? []).map((tx) => ({
		id: tx.id,
		date: tx.date,
		merchant: tx.is_private && tx.user_id !== user.id ? null : tx.merchant,
		amount: Number(tx.amount),
		is_private: tx.is_private
	}));

	return json({ transactions: sanitized });
};

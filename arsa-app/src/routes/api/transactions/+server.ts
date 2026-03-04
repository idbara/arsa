import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { sendPushToFamilyAdmins } from '$lib/server/push';

export const POST: RequestHandler = async ({ request, locals: { supabase, safeGetSession } }) => {
	const { user } = await safeGetSession();
	if (!user) {
		return json({ error: 'Unauthorized' }, { status: 401 });
	}

	const { data: profile } = await supabase
		.from('users')
		.select('family_id')
		.eq('id', user.id)
		.single();

	if (!profile?.family_id) {
		return json({ error: 'No family found' }, { status: 400 });
	}

	const body = await request.json();
	const { type, account_id, date, merchant, notes, is_private, receipt_url, items } = body;

	if (!type || !account_id || !items?.length) {
		return json({ error: 'Missing required fields' }, { status: 400 });
	}

	const groupId = items.length > 1 ? crypto.randomUUID() : null;

	const transactions = items.map((item: { amount: number; category_id: string | null }) => ({
		family_id: profile.family_id,
		account_id,
		category_id: type === 'transfer' ? null : item.category_id,
		user_id: user.id,
		amount: item.amount,
		type,
		date: date || new Date().toISOString().split('T')[0],
		merchant: merchant || null,
		notes: notes || null,
		is_private: is_private || false,
		receipt_url: receipt_url || null,
		group_id: groupId
	}));

	const { error: txError } = await supabase.from('transactions').insert(transactions);

	if (txError) {
		return json({ error: 'Failed to create transaction' }, { status: 500 });
	}

	const totalAmount = items.reduce((sum: number, item: { amount: number }) => sum + item.amount, 0);
	const balanceDelta = type === 'in' ? totalAmount : -totalAmount;

	const { data: account } = await supabase
		.from('accounts')
		.select('balance')
		.eq('id', account_id)
		.single();

	if (account) {
		await supabase
			.from('accounts')
			.update({ balance: Number(account.balance) + balanceDelta })
			.eq('id', account_id);
	}

	if (type === 'transfer' && body.transfer_to) {
		const { data: destAccount } = await supabase
			.from('accounts')
			.select('balance')
			.eq('id', body.transfer_to)
			.single();

		if (destAccount) {
			await supabase
				.from('accounts')
				.update({ balance: Number(destAccount.balance) + totalAmount })
				.eq('id', body.transfer_to);
		}
	}

	// Budget alert: check if any category exceeded its monthly limit
	if (type === 'out') {
		const txDate = date || new Date().toISOString().split('T')[0];
		const monthStart = txDate.substring(0, 7) + '-01';
		const nextMonth = new Date(monthStart);
		nextMonth.setMonth(nextMonth.getMonth() + 1);
		const monthEnd = nextMonth.toISOString().split('T')[0];

		for (const item of items as { amount: number; category_id: string | null }[]) {
			if (!item.category_id) continue;

			const { data: category } = await supabase
				.from('categories')
				.select('name, monthly_limit')
				.eq('id', item.category_id)
				.single();

			if (category?.monthly_limit) {
				const { data: monthTxns } = await supabase
					.from('transactions')
					.select('amount')
					.eq('family_id', profile.family_id)
					.eq('category_id', item.category_id)
					.eq('type', 'out')
					.gte('date', monthStart)
					.lt('date', monthEnd);

				const totalSpend = (monthTxns ?? []).reduce(
					(s: number, t: { amount: number }) => s + Number(t.amount),
					0
				);

				if (totalSpend > Number(category.monthly_limit)) {
					await sendPushToFamilyAdmins(supabase, profile.family_id, {
						title: 'Budget Alert',
						body: `${category.name} exceeded Rp${Number(category.monthly_limit).toLocaleString('id-ID')} this month`,
						icon: '/icons/icon-192.png',
						url: '/history'
					});
				}
			}
		}
	}

	return json({ success: true });
};

import type { PageServerLoad } from './$types';

interface Transaction {
	id: string;
	amount: string;
	type: string;
	date: string;
	merchant: string | null;
	notes: string | null;
	is_private: boolean;
	user_id: string;
	receipt_url: string | null;
	is_reconciled: boolean;
	categories: { name: string } | null;
	accounts: { name: string } | null;
}

interface DateGroup {
	label: string;
	date: string;
	transactions: Transaction[];
}

function getDateLabel(dateStr: string): string {
	const date = new Date(dateStr + 'T00:00:00');
	const today = new Date();
	today.setHours(0, 0, 0, 0);

	const yesterday = new Date(today);
	yesterday.setDate(yesterday.getDate() - 1);

	if (date.getTime() === today.getTime()) return 'Today';
	if (date.getTime() === yesterday.getTime()) return 'Yesterday';

	return date.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
}

export const load: PageServerLoad = async ({ locals: { supabase, safeGetSession }, url }) => {
	const { user } = await safeGetSession();
	if (!user) return { groups: [], hasMore: false };

	const { data: profile } = await supabase
		.from('users')
		.select('family_id')
		.eq('id', user.id)
		.single();

	if (!profile?.family_id) return { groups: [], hasMore: false };

	const page = parseInt(url.searchParams.get('page') ?? '0');
	const limit = 50;
	const offset = page * limit;

	const { data: transactions, count } = await supabase
		.from('transactions')
		.select(
			'id, amount, type, date, merchant, notes, is_private, user_id, receipt_url, is_reconciled, categories(name), accounts(name)',
			{ count: 'exact' }
		)
		.eq('family_id', profile.family_id)
		.order('date', { ascending: false })
		.order('created_at', { ascending: false })
		.range(offset, offset + limit - 1);

	const sanitized = (transactions ?? []).map((tx) => ({
		...tx,
		merchant: tx.is_private && tx.user_id !== user.id ? null : tx.merchant,
		notes: tx.is_private && tx.user_id !== user.id ? null : tx.notes
	}));

	const groupMap = new Map<string, Transaction[]>();
	for (const tx of sanitized) {
		const existing = groupMap.get(tx.date) ?? [];
		existing.push(tx as Transaction);
		groupMap.set(tx.date, existing);
	}

	const groups: DateGroup[] = Array.from(groupMap.entries()).map(([date, txs]) => ({
		label: getDateLabel(date),
		date,
		transactions: txs
	}));

	const totalCount = count ?? 0;
	const hasMore = offset + limit < totalCount;

	const { data: reconCandidates } = await supabase
		.from('transactions')
		.select('id, amount, type, date, merchant, is_reconciled, categories(name), accounts(name)')
		.eq('family_id', profile.family_id)
		.eq('is_reconciled', false)
		.order('date', { ascending: false });

	return { groups, hasMore, nextPage: page + 1, reconCandidates: reconCandidates ?? [] };
};

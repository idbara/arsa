import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';

export const POST: RequestHandler = async ({ request, locals: { supabase, safeGetSession } }) => {
	const { user } = await safeGetSession();
	if (!user) {
		error(401, 'Unauthorized');
	}

	const { transactionIds } = await request.json();

	if (!Array.isArray(transactionIds) || transactionIds.length === 0) {
		error(400, 'No transaction IDs provided');
	}

	const { error: updateError } = await supabase
		.from('transactions')
		.update({ is_reconciled: true })
		.in('id', transactionIds);

	if (updateError) {
		error(500, 'Failed to reconcile transactions');
	}

	return json({ success: true, count: transactionIds.length });
};

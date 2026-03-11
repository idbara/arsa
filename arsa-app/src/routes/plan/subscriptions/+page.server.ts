import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ locals: { supabase, safeGetSession } }) => {
	const { user } = await safeGetSession();

	const { data: profile } = await supabase
		.from('users')
		.select('family_id')
		.eq('id', user!.id)
		.single();

	const { data: subscriptions } = await supabase
		.from('subscriptions')
		.select(
			'id, name, amount, frequency, next_due_date, is_active, notes, category_id, account_id, categories(name), accounts(name)'
		)
		.eq('family_id', profile!.family_id)
		.order('next_due_date');

	return { subscriptions: subscriptions ?? [] };
};

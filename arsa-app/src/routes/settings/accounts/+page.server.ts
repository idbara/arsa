import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ locals: { supabase, safeGetSession } }) => {
	const { user } = await safeGetSession();

	const { data: profile } = await supabase
		.from('users')
		.select('family_id')
		.eq('id', user!.id)
		.single();

	const { data: accounts } = await supabase
		.from('accounts')
		.select('id, name, type, balance')
		.eq('family_id', profile!.family_id)
		.order('name');

	return { accounts: accounts ?? [] };
};

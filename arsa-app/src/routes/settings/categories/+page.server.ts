import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ locals: { supabase, safeGetSession } }) => {
	const { user } = await safeGetSession();

	const { data: profile } = await supabase
		.from('users')
		.select('family_id, role')
		.eq('id', user!.id)
		.single();

	const { data: categories } = await supabase
		.from('categories')
		.select('id, name, monthly_limit, is_child_related')
		.eq('family_id', profile!.family_id)
		.order('name');

	return {
		categories: categories ?? [],
		isAdmin: profile!.role === 'admin'
	};
};

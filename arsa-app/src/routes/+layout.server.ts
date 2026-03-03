import type { LayoutServerLoad } from './$types';

export const load: LayoutServerLoad = async ({ locals: { safeGetSession, supabase }, cookies }) => {
	const { session, user } = await safeGetSession();

	let accounts: { id: string; name: string; type: string }[] = [];
	let categories: { id: string; name: string }[] = [];

	if (user) {
		const { data: profile } = await supabase
			.from('users')
			.select('family_id')
			.eq('id', user.id)
			.single();

		if (profile?.family_id) {
			const [acctResult, catResult] = await Promise.all([
				supabase
					.from('accounts')
					.select('id, name, type')
					.eq('family_id', profile.family_id)
					.order('name'),
				supabase
					.from('categories')
					.select('id, name')
					.eq('family_id', profile.family_id)
					.order('name')
			]);

			accounts = acctResult.data ?? [];
			categories = catResult.data ?? [];
		}
	}

	return {
		session,
		user,
		cookies: cookies.getAll(),
		accounts,
		categories
	};
};

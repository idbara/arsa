import { redirect } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ locals, url }) => {
	const session = await locals.safeGetSession();
	if (!session.session) redirect(303, '/login');

	const supabase = locals.supabase;
	const userId = session.session.user.id;

	const { data: profile } = await supabase
		.from('users')
		.select('family_id')
		.eq('id', userId)
		.single();

	if (!profile?.family_id) redirect(303, '/onboarding');

	const filterUser = url.searchParams.get('user') || null;
	const filterMonth = url.searchParams.get('month') || null;

	let query = supabase
		.from('point_events')
		.select('*, users!user_id(display_name)')
		.eq('family_id', profile.family_id)
		.order('created_at', { ascending: false })
		.limit(50);

	if (filterUser) query = query.eq('user_id', filterUser);
	if (filterMonth) query = query.eq('month', filterMonth);

	const [eventsRes, membersRes] = await Promise.all([
		query,
		supabase.from('users').select('id, display_name').eq('family_id', profile.family_id)
	]);

	return {
		events: eventsRes.data ?? [],
		members: membersRes.data ?? [],
		filterUser,
		filterMonth
	};
};

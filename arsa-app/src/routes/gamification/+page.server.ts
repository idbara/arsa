import { redirect } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ locals }) => {
	const session = await locals.safeGetSession();
	if (!session.session) redirect(303, '/login');

	const supabase = locals.supabase;
	const userId = session.session.user.id;

	const { data: profile } = await supabase
		.from('users')
		.select('family_id, display_name')
		.eq('id', userId)
		.single();

	if (!profile?.family_id) redirect(303, '/onboarding');

	const familyId = profile.family_id;
	const now = new Date();
	const firstOfMonth = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().split('T')[0];

	const [gamificationRes, leaderboardRes, recentEventsRes] = await Promise.all([
		supabase
			.from('gamification')
			.select('*')
			.eq('family_id', familyId)
			.eq('user_id', userId)
			.single(),

		supabase
			.from('gamification')
			.select('user_id, current_points, streak_days, users!inner(display_name)')
			.eq('family_id', familyId)
			.order('current_points', { ascending: false }),

		supabase
			.from('point_events')
			.select('*')
			.eq('family_id', familyId)
			.order('created_at', { ascending: false })
			.limit(5)
	]);

	const pointsThisMonthRes = await supabase
		.from('point_events')
		.select('user_id, points')
		.eq('family_id', familyId)
		.eq('month', firstOfMonth);

	const pointsByUser: Record<string, number> = {};
	for (const evt of pointsThisMonthRes.data ?? []) {
		pointsByUser[evt.user_id] = (pointsByUser[evt.user_id] ?? 0) + evt.points;
	}

	const leaderboard = (leaderboardRes.data ?? []).map((row: Record<string, unknown>) => ({
		user_id: row.user_id as string,
		display_name: String((row.users as Record<string, unknown> | null)?.display_name ?? 'Unknown'),
		current_points: row.current_points as number,
		streak_days: row.streak_days as number,
		points_this_month: pointsByUser[row.user_id as string] ?? 0
	}));

	return {
		myProfile: gamificationRes.data,
		leaderboard,
		recentEvents: recentEventsRes.data ?? [],
		userId
	};
};

import { fail, redirect } from '@sveltejs/kit';
import type { Actions, PageServerLoad } from './$types';
import { sendPushToUser } from '$lib/server/push';

export const load: PageServerLoad = async ({ locals }) => {
	const session = await locals.safeGetSession();
	if (!session.session) redirect(303, '/login');

	const supabase = locals.supabase;
	const userId = session.session.user.id;

	const { data: profile } = await supabase
		.from('users')
		.select('family_id, role')
		.eq('id', userId)
		.single();

	if (!profile?.family_id) redirect(303, '/onboarding');

	const [approvedRes, pendingRes, myPointsRes] = await Promise.all([
		supabase
			.from('rewards')
			.select('*')
			.eq('family_id', profile.family_id)
			.eq('status', 'approved')
			.order('created_at', { ascending: false }),

		supabase
			.from('rewards')
			.select('*, users!proposed_by(display_name)')
			.eq('family_id', profile.family_id)
			.eq('status', 'pending')
			.order('created_at', { ascending: false }),

		supabase
			.from('gamification')
			.select('current_points')
			.eq('family_id', profile.family_id)
			.eq('user_id', userId)
			.single()
	]);

	return {
		approvedRewards: approvedRes.data ?? [],
		pendingRewards: pendingRes.data ?? [],
		myPoints: myPointsRes.data?.current_points ?? 0,
		isAdmin: profile.role === 'admin',
		userId,
		familyId: profile.family_id
	};
};

export const actions: Actions = {
	propose: async ({ request, locals }) => {
		const session = await locals.safeGetSession();
		if (!session.session) return fail(401, { error: 'Not authenticated' });

		const supabase = locals.supabase;
		const formData = await request.formData();
		const name = formData.get('name') as string;
		const description = formData.get('description') as string;
		const pointCost = parseInt(formData.get('point_cost') as string, 10);

		if (!name || !pointCost || pointCost < 1) {
			return fail(400, { error: 'Name and valid point cost required.' });
		}

		const { data: profile } = await supabase
			.from('users')
			.select('family_id')
			.eq('id', session.session.user.id)
			.single();

		if (!profile?.family_id) return fail(400, { error: 'No family.' });

		const { error } = await supabase.from('rewards').insert({
			family_id: profile.family_id,
			name,
			description: description || null,
			point_cost: pointCost,
			proposed_by: session.session.user.id
		});

		if (error) return fail(500, { error: error.message });
		return { success: true };
	},

	approve: async ({ request, locals }) => {
		const session = await locals.safeGetSession();
		if (!session.session) return fail(401, { error: 'Not authenticated' });

		const supabase = locals.supabase;
		const formData = await request.formData();
		const rewardId = formData.get('reward_id') as string;
		const pointCost = parseInt(formData.get('point_cost') as string, 10);

		const { error } = await supabase
			.from('rewards')
			.update({
				status: 'approved',
				approved_by: session.session.user.id,
				point_cost: pointCost
			})
			.eq('id', rewardId);

		if (error) return fail(500, { error: error.message });

		const { data: reward } = await supabase
			.from('rewards')
			.select('name, proposed_by')
			.eq('id', rewardId)
			.single();

		if (reward) {
			await sendPushToUser(supabase, reward.proposed_by, {
				title: 'Reward Approved!',
				body: `"${reward.name}" is now available to redeem`,
				icon: '/icons/icon-192.png',
				url: '/gamification/rewards'
			});
		}

		return { success: true };
	},

	reject: async ({ request, locals }) => {
		const session = await locals.safeGetSession();
		if (!session.session) return fail(401, { error: 'Not authenticated' });

		const supabase = locals.supabase;
		const formData = await request.formData();
		const rewardId = formData.get('reward_id') as string;

		const { error } = await supabase
			.from('rewards')
			.update({ status: 'rejected', approved_by: session.session.user.id })
			.eq('id', rewardId);

		if (error) return fail(500, { error: error.message });
		return { success: true };
	},

	redeem: async ({ request, locals }) => {
		const session = await locals.safeGetSession();
		if (!session.session) return fail(401, { error: 'Not authenticated' });

		const supabase = locals.supabase;
		const userId = session.session.user.id;
		const formData = await request.formData();
		const rewardId = formData.get('reward_id') as string;

		const { data: profile } = await supabase
			.from('users')
			.select('family_id')
			.eq('id', userId)
			.single();

		if (!profile?.family_id) return fail(400, { error: 'No family.' });

		const { data: reward } = await supabase
			.from('rewards')
			.select('point_cost')
			.eq('id', rewardId)
			.eq('status', 'approved')
			.single();

		if (!reward) return fail(404, { error: 'Reward not found.' });

		const { data: gam } = await supabase
			.from('gamification')
			.select('current_points')
			.eq('family_id', profile.family_id)
			.eq('user_id', userId)
			.single();

		if (!gam || gam.current_points < reward.point_cost) {
			return fail(400, {
				error: `Need ${reward.point_cost} points. You have ${gam?.current_points ?? 0}.`
			});
		}

		const { error: redeemError } = await supabase.from('reward_redemptions').insert({
			family_id: profile.family_id,
			reward_id: rewardId,
			redeemed_by: userId,
			points_spent: reward.point_cost
		});

		if (redeemError) return fail(500, { error: redeemError.message });

		const { error: eventError } = await supabase.from('point_events').insert({
			family_id: profile.family_id,
			user_id: userId,
			points: -reward.point_cost,
			description: `Redeemed: ${rewardId}`,
			month: new Date(new Date().getFullYear(), new Date().getMonth(), 1)
				.toISOString()
				.split('T')[0]
		});

		if (eventError) return fail(500, { error: eventError.message });

		await supabase
			.from('gamification')
			.update({ current_points: gam.current_points - reward.point_cost })
			.eq('family_id', profile.family_id)
			.eq('user_id', userId);

		return { success: true };
	}
};

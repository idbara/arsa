import { fail, redirect } from '@sveltejs/kit';
import type { Actions, PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ locals: { safeGetSession, supabase }, url }) => {
	const { user } = await safeGetSession();
	if (!user) {
		redirect(303, '/login');
	}

	const { data: profile } = await supabase
		.from('users')
		.select('family_id, role')
		.eq('id', user.id)
		.single();

	if (!profile?.family_id) {
		redirect(303, '/onboarding');
	}

	const { data: existingInvite } = await supabase
		.from('invites')
		.select('token, expires_at')
		.eq('family_id', profile.family_id)
		.is('used_at', null)
		.gt('expires_at', new Date().toISOString())
		.order('created_at', { ascending: false })
		.limit(1)
		.single();

	const baseUrl = url.origin;

	return {
		inviteLink: existingInvite ? `${baseUrl}/invite/${existingInvite.token}` : null,
		familyId: profile.family_id
	};
};

export const actions: Actions = {
	generate: async ({ locals: { supabase, safeGetSession }, url }) => {
		const { user } = await safeGetSession();
		if (!user) {
			redirect(303, '/login');
		}

		const { data: profile } = await supabase
			.from('users')
			.select('family_id')
			.eq('id', user.id)
			.single();

		if (!profile?.family_id) {
			return fail(400, { error: 'You must belong to a family first.' });
		}

		const { data: invite, error } = await supabase
			.from('invites')
			.insert({ family_id: profile.family_id, created_by: user.id })
			.select('token')
			.single();

		if (error) {
			return fail(500, { error: 'Failed to generate invite.' });
		}

		return { inviteLink: `${url.origin}/invite/${invite.token}` };
	}
};

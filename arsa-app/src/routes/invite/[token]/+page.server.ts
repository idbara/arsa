import { fail, redirect } from '@sveltejs/kit';
import type { Actions, PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ params, locals: { safeGetSession, supabase } }) => {
	const { data: invite } = await supabase
		.from('invites')
		.select('id, family_id, expires_at, used_at, families(name)')
		.eq('token', params.token)
		.single();

	if (!invite) {
		return { error: 'Invalid invite link.' };
	}

	if (invite.used_at) {
		return { error: 'This invite has already been used.' };
	}

	if (new Date(invite.expires_at) < new Date()) {
		return { error: 'This invite has expired.' };
	}

	const { session } = await safeGetSession();

	return {
		familyName: (invite.families as unknown as { name: string })?.name ?? 'Unknown',
		token: params.token,
		isAuthenticated: !!session
	};
};

export const actions: Actions = {
	join: async ({ params, locals: { supabase, safeGetSession } }) => {
		const { user } = await safeGetSession();
		if (!user) {
			redirect(303, `/login?redirect=/invite/${params.token}`);
		}

		const { data: invite, error: inviteError } = await supabase
			.from('invites')
			.select('id, family_id, expires_at, used_at')
			.eq('token', params.token)
			.single();

		if (inviteError || !invite) {
			return fail(400, { error: 'Invalid invite link.' });
		}

		if (invite.used_at) {
			return fail(400, { error: 'This invite has already been used.' });
		}

		if (new Date(invite.expires_at) < new Date()) {
			return fail(400, { error: 'This invite has expired.' });
		}

		const { data: profile } = await supabase
			.from('users')
			.select('family_id')
			.eq('id', user.id)
			.single();

		if (profile?.family_id) {
			return fail(400, { error: 'You already belong to a family.' });
		}

		const { error: updateError } = await supabase
			.from('users')
			.update({ family_id: invite.family_id, role: 'member' })
			.eq('id', user.id);

		if (updateError) {
			return fail(500, { error: 'Failed to join family.' });
		}

		await supabase
			.from('invites')
			.update({ used_at: new Date().toISOString() })
			.eq('id', invite.id);

		redirect(303, '/');
	}
};

import { fail, redirect } from '@sveltejs/kit';
import type { Actions, PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ locals: { safeGetSession, supabase } }) => {
	const { user } = await safeGetSession();
	if (!user) {
		redirect(303, '/login');
	}

	const { data: profile } = await supabase
		.from('users')
		.select('family_id')
		.eq('id', user.id)
		.single();

	if (profile?.family_id) {
		redirect(303, '/');
	}
};

export const actions: Actions = {
	create: async ({ request, locals: { supabase, safeGetSession } }) => {
		const { user } = await safeGetSession();
		if (!user) {
			redirect(303, '/login');
		}

		const formData = await request.formData();
		const familyName = formData.get('family_name') as string;

		if (!familyName) {
			return fail(400, { error: 'Family name is required.' });
		}

		const familyId = crypto.randomUUID();

		const { error: familyError } = await supabase
			.from('families')
			.insert({ id: familyId, name: familyName });

		if (familyError) {
			return fail(500, { error: 'Failed to create family.' });
		}

		const { error: upsertError } = await supabase.from('users').upsert(
			{
				id: user.id,
				family_id: familyId,
				role: 'admin',
				display_name: user.user_metadata?.display_name ?? user.email?.split('@')[0] ?? 'User'
			},
			{ onConflict: 'id' }
		);

		if (upsertError) {
			return fail(500, { error: `Failed to link your account: ${upsertError.message}` });
		}

		redirect(303, '/onboarding/invite');
	}
};

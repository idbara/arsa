import { fail, redirect } from '@sveltejs/kit';
import type { Actions } from './$types';

export const actions: Actions = {
	default: async ({ request, locals: { supabase, safeGetSession } }) => {
		const { user } = await safeGetSession();

		const { data: profile } = await supabase
			.from('users')
			.select('family_id')
			.eq('id', user!.id)
			.single();

		const formData = await request.formData();
		const name = formData.get('name') as string;
		const type = formData.get('type') as string;
		const balance = parseFloat(formData.get('balance') as string) || 0;

		if (!name || !type) {
			return fail(400, { error: 'Name and type are required.', name, type, balance });
		}

		const { error } = await supabase
			.from('accounts')
			.insert({ family_id: profile!.family_id, name, type, balance });

		if (error) {
			return fail(500, { error: 'Failed to create account.', name, type, balance });
		}

		redirect(303, '/settings/accounts');
	}
};

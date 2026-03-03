import { fail, redirect, error } from '@sveltejs/kit';
import type { Actions, PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ params, locals: { supabase } }) => {
	const { data: account } = await supabase
		.from('accounts')
		.select('id, name, type, balance')
		.eq('id', params.id)
		.single();

	if (!account) {
		error(404, 'Account not found');
	}

	return { account };
};

export const actions: Actions = {
	update: async ({ params, request, locals: { supabase } }) => {
		const formData = await request.formData();
		const name = formData.get('name') as string;
		const type = formData.get('type') as string;

		if (!name || !type) {
			return fail(400, { error: 'Name and type are required.' });
		}

		const { error: updateError } = await supabase
			.from('accounts')
			.update({ name, type })
			.eq('id', params.id);

		if (updateError) {
			return fail(500, { error: 'Failed to update account.' });
		}

		redirect(303, '/settings/accounts');
	},

	delete: async ({ params, locals: { supabase } }) => {
		const { count } = await supabase
			.from('transactions')
			.select('id', { count: 'exact', head: true })
			.eq('account_id', params.id);

		if (count && count > 0) {
			return fail(400, {
				error: `Cannot delete — account has ${count} transaction(s). Remove them first.`
			});
		}

		const { error: deleteError } = await supabase.from('accounts').delete().eq('id', params.id);

		if (deleteError) {
			return fail(500, { error: 'Failed to delete account.' });
		}

		redirect(303, '/settings/accounts');
	}
};

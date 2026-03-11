import { fail, redirect } from '@sveltejs/kit';
import type { Actions, PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ locals: { supabase, safeGetSession } }) => {
	const { user } = await safeGetSession();
	const { data: profile } = await supabase.from('users').select('role').eq('id', user!.id).single();

	if (profile?.role !== 'admin') {
		redirect(303, '/settings/categories');
	}
};

export const actions: Actions = {
	default: async ({ request, locals: { supabase, safeGetSession } }) => {
		const { user } = await safeGetSession();

		const { data: profile } = await supabase
			.from('users')
			.select('family_id, role')
			.eq('id', user!.id)
			.single();

		if (profile?.role !== 'admin') {
			return fail(403, { error: 'Only admins can create categories.', name: '', monthlyLimit: '', isChildRelated: false });
		}

		const formData = await request.formData();
		const name = formData.get('name') as string;
		const monthlyLimit = formData.get('monthly_limit') as string;
		const isChildRelated = formData.get('is_child_related') === 'on';

		if (!name) {
			return fail(400, { error: 'Name is required.', name, monthlyLimit, isChildRelated });
		}

		const { error } = await supabase.from('categories').insert({
			family_id: profile!.family_id,
			name,
			monthly_limit: monthlyLimit ? parseFloat(monthlyLimit) : null,
			is_child_related: isChildRelated
		});

		if (error) {
			return fail(500, {
				error: 'Failed to create category.',
				name,
				monthlyLimit,
				isChildRelated
			});
		}

		redirect(303, '/settings/categories');
	}
};

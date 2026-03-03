import { fail, redirect, error } from '@sveltejs/kit';
import type { Actions, PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ params, locals: { supabase, safeGetSession } }) => {
	const { user } = await safeGetSession();
	const { data: profile } = await supabase.from('users').select('role').eq('id', user!.id).single();

	if (profile?.role !== 'admin') {
		redirect(303, '/settings/categories');
	}

	const { data: category } = await supabase
		.from('categories')
		.select('id, name, monthly_limit, is_child_related')
		.eq('id', params.id)
		.single();

	if (!category) {
		error(404, 'Category not found');
	}

	return { category };
};

export const actions: Actions = {
	update: async ({ params, request, locals: { supabase, safeGetSession } }) => {
		const { user } = await safeGetSession();
		const { data: profile } = await supabase
			.from('users')
			.select('role')
			.eq('id', user!.id)
			.single();

		if (profile?.role !== 'admin') {
			return fail(403, { error: 'Only admins can edit categories.' });
		}

		const formData = await request.formData();
		const name = formData.get('name') as string;
		const monthlyLimit = formData.get('monthly_limit') as string;
		const isChildRelated = formData.get('is_child_related') === 'on';

		if (!name) {
			return fail(400, { error: 'Name is required.' });
		}

		const { error: updateError } = await supabase
			.from('categories')
			.update({
				name,
				monthly_limit: monthlyLimit ? parseFloat(monthlyLimit) : null,
				is_child_related: isChildRelated
			})
			.eq('id', params.id);

		if (updateError) {
			return fail(500, { error: 'Failed to update category.' });
		}

		redirect(303, '/settings/categories');
	},

	delete: async ({ params, locals: { supabase, safeGetSession } }) => {
		const { user } = await safeGetSession();
		const { data: profile } = await supabase
			.from('users')
			.select('role')
			.eq('id', user!.id)
			.single();

		if (profile?.role !== 'admin') {
			return fail(403, { error: 'Only admins can delete categories.' });
		}

		const { count } = await supabase
			.from('transactions')
			.select('id', { count: 'exact', head: true })
			.eq('category_id', params.id);

		if (count && count > 0) {
			return fail(400, {
				error: `Cannot delete — category has ${count} transaction(s).`
			});
		}

		const { error: deleteError } = await supabase.from('categories').delete().eq('id', params.id);

		if (deleteError) {
			return fail(500, { error: 'Failed to delete category.' });
		}

		redirect(303, '/settings/categories');
	}
};

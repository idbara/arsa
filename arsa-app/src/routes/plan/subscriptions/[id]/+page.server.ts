import { fail, redirect, error } from '@sveltejs/kit';
import type { Actions, PageServerLoad } from './$types';
import { computeNextDueDate } from '$lib/types/subscription';
import type { Frequency } from '$lib/types/subscription';

const VALID_FREQUENCIES: Frequency[] = [
	'daily',
	'weekly',
	'monthly',
	'quarterly',
	'semi_annual',
	'annual'
];

export const load: PageServerLoad = async ({ params, locals: { supabase } }) => {
	const { data: subscription } = await supabase
		.from('subscriptions')
		.select(
			'id, name, amount, frequency, category_id, account_id, start_date, next_due_date, is_active, notes'
		)
		.eq('id', params.id)
		.single();

	if (!subscription) {
		error(404, 'Langganan tidak ditemukan');
	}

	return { subscription };
};

export const actions: Actions = {
	update: async ({ params, request, locals: { supabase } }) => {
		const formData = await request.formData();
		const name = (formData.get('name') as string)?.trim();
		const amount = parseFloat(formData.get('amount') as string);
		const frequency = formData.get('frequency') as Frequency;
		const category_id = (formData.get('category_id') as string) || null;
		const account_id = (formData.get('account_id') as string) || null;
		const start_date = formData.get('start_date') as string;
		const is_active = formData.get('is_active') === 'on';
		const notes = (formData.get('notes') as string)?.trim() || null;

		if (!name || !amount || !frequency || !start_date) {
			return fail(400, { error: 'Nama, jumlah, frekuensi, dan tanggal mulai wajib diisi.' });
		}

		if (!VALID_FREQUENCIES.includes(frequency)) {
			return fail(400, { error: 'Frekuensi tidak valid.' });
		}

		const { data: current } = await supabase
			.from('subscriptions')
			.select('frequency, start_date, next_due_date')
			.eq('id', params.id)
			.single();

		let next_due_date = current?.next_due_date;
		if (current?.frequency !== frequency || current?.start_date !== start_date) {
			next_due_date = computeNextDueDate(start_date, frequency);
		}

		const { error: updateError } = await supabase
			.from('subscriptions')
			.update({
				name,
				amount,
				frequency,
				category_id,
				account_id,
				start_date,
				next_due_date,
				is_active,
				notes,
				updated_at: new Date().toISOString()
			})
			.eq('id', params.id);

		if (updateError) {
			return fail(500, { error: 'Gagal memperbarui langganan.' });
		}

		redirect(303, '/plan/subscriptions');
	},

	delete: async ({ params, locals: { supabase } }) => {
		const { error: deleteError } = await supabase
			.from('subscriptions')
			.delete()
			.eq('id', params.id);

		if (deleteError) {
			return fail(500, { error: 'Gagal menghapus langganan.' });
		}

		redirect(303, '/plan/subscriptions');
	}
};

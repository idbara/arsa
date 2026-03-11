import { fail, redirect } from '@sveltejs/kit';
import type { Actions } from './$types';
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

export const actions: Actions = {
	default: async ({ request, locals: { supabase, safeGetSession } }) => {
		const { user } = await safeGetSession();

		const { data: profile } = await supabase
			.from('users')
			.select('family_id')
			.eq('id', user!.id)
			.single();

		const formData = await request.formData();
		const name = (formData.get('name') as string)?.trim();
		const amount = parseFloat(formData.get('amount') as string);
		const frequency = formData.get('frequency') as Frequency;
		const category_id = (formData.get('category_id') as string) || null;
		const account_id = (formData.get('account_id') as string) || null;
		const start_date = formData.get('start_date') as string;
		const notes = (formData.get('notes') as string)?.trim() || null;

		if (!name || !amount || !frequency || !start_date) {
			return fail(400, {
				error: 'Nama, jumlah, frekuensi, dan tanggal mulai wajib diisi.',
				name,
				amount,
				frequency,
				category_id,
				account_id,
				start_date,
				notes
			});
		}

		if (!VALID_FREQUENCIES.includes(frequency)) {
			return fail(400, {
				error: 'Frekuensi tidak valid.',
				name,
				amount,
				frequency,
				category_id,
				account_id,
				start_date,
				notes
			});
		}

		const next_due_date = computeNextDueDate(start_date, frequency);

		const { error } = await supabase.from('subscriptions').insert({
			family_id: profile!.family_id,
			user_id: user!.id,
			name,
			amount,
			frequency,
			category_id,
			account_id,
			start_date,
			next_due_date,
			notes
		});

		if (error) {
			return fail(500, {
				error: 'Gagal membuat langganan.',
				name,
				amount,
				frequency,
				category_id,
				account_id,
				start_date,
				notes
			});
		}

		redirect(303, '/plan/subscriptions');
	}
};

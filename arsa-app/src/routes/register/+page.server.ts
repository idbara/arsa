import { fail, redirect } from '@sveltejs/kit';
import type { Actions, PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ locals: { safeGetSession } }) => {
	const { session } = await safeGetSession();
	if (session) {
		redirect(303, '/');
	}
};

export const actions: Actions = {
	default: async ({ request, locals: { supabase } }) => {
		const formData = await request.formData();
		const email = formData.get('email') as string;
		const password = formData.get('password') as string;
		const displayName = formData.get('display_name') as string;

		if (!email || !password || !displayName) {
			return fail(400, { error: 'All fields are required.', email, displayName });
		}

		if (password.length < 6) {
			return fail(400, {
				error: 'Password must be at least 6 characters.',
				email,
				displayName
			});
		}

		const { data: authData, error: authError } = await supabase.auth.signUp({
			email,
			password
		});

		if (authError) {
			return fail(400, { error: authError.message, email, displayName });
		}

		if (authData.user) {
			const { error: profileError } = await supabase
				.from('users')
				.insert({ id: authData.user.id, display_name: displayName });

			if (profileError) {
				return fail(500, {
					error: 'Account created but profile setup failed. Try logging in.',
					email,
					displayName
				});
			}
		}

		redirect(303, '/onboarding');
	}
};

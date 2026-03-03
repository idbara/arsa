import { PUBLIC_SUPABASE_URL, PUBLIC_SUPABASE_ANON_KEY } from '$env/static/public';
import { createServerClient } from '@supabase/ssr';
import { redirect, type Handle } from '@sveltejs/kit';

export const handle: Handle = async ({ event, resolve }) => {
	event.locals.supabase = createServerClient(PUBLIC_SUPABASE_URL, PUBLIC_SUPABASE_ANON_KEY, {
		cookies: {
			getAll: () => event.cookies.getAll(),
			setAll: (cookiesToSet) => {
				cookiesToSet.forEach(({ name, value, options }) => {
					event.cookies.set(name, value, { ...options, path: '/' });
				});
			}
		}
	});

	event.locals.safeGetSession = async () => {
		const {
			data: { user },
			error
		} = await event.locals.supabase.auth.getUser();
		if (error) {
			return { session: null, user: null };
		}
		const {
			data: { session }
		} = await event.locals.supabase.auth.getSession();
		return { session, user };
	};

	const publicRoutes = ['/login', '/register'];
	const isPublic = publicRoutes.some((r) => event.url.pathname.startsWith(r));
	const isInvite = event.url.pathname.startsWith('/invite/');

	if (!isPublic && !isInvite) {
		const { session, user } = await event.locals.safeGetSession();

		if (!session) {
			redirect(303, '/login');
		}

		if (!event.url.pathname.startsWith('/onboarding')) {
			const { data: profile } = await event.locals.supabase
				.from('users')
				.select('family_id')
				.eq('id', user!.id)
				.single();

			if (!profile?.family_id) {
				redirect(303, '/onboarding');
			}
		}
	}

	return resolve(event, {
		filterSerializedResponseHeaders(name) {
			return name === 'content-range' || name === 'x-supabase-api-version';
		}
	});
};

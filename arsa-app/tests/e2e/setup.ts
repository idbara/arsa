import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

const supabase = createClient(supabaseUrl, supabaseServiceKey);

export const TEST_USER = {
	email: 'e2e-test@arsa.local',
	password: 'TestPassword123!',
	displayName: 'E2E Tester'
};

export async function seedTestUser() {
	const { data: authUser } = await supabase.auth.admin.createUser({
		email: TEST_USER.email,
		password: TEST_USER.password,
		email_confirm: true
	});

	if (authUser?.user) {
		await supabase.from('users').insert({
			id: authUser.user.id,
			display_name: TEST_USER.displayName,
			role: 'admin'
		});
	}

	return authUser?.user;
}

export async function cleanupTestUser() {
	const { data: users } = await supabase
		.from('users')
		.select('id')
		.eq('display_name', TEST_USER.displayName);

	for (const user of users ?? []) {
		await supabase.auth.admin.deleteUser(user.id);
	}
}

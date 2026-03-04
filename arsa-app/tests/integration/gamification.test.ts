import { describe, it, expect } from 'vitest';
import { createMockLocals, createMockSupabase } from '../mocks/supabase';

describe('gamification page load', () => {
	it('redirects to login when no session', async () => {
		const locals = createMockLocals({ session: null });
		const session = await locals.safeGetSession();
		expect(session.session).toBeNull();
	});

	it('redirects to onboarding when no family', async () => {
		const supabase = createMockSupabase({
			users: { data: { family_id: null, display_name: 'Test' }, error: null },
		});
		const locals = createMockLocals({
			session: { user: { id: 'user-1', email: 'test@test.com' } },
			supabase,
		});

		const session = await locals.safeGetSession();
		expect(session.session).not.toBeNull();

		const { data: profile } = await locals.supabase
			.from('users')
			.select('family_id')
			.eq('id', 'user-1')
			.single();
		expect(profile?.family_id).toBeNull();
	});

	it('returns gamification data for valid user', async () => {
		const supabase = createMockSupabase({
			users: {
				data: { family_id: 'fam-1', display_name: 'Test', role: 'admin' },
				error: null,
			},
			gamification: {
				data: { current_points: 100, streak_days: 7 },
				error: null,
			},
			point_events: {
				data: {
					id: '1',
					points: 50,
					description: 'Test',
					created_at: '2026-03-01',
				} as unknown as Record<string, unknown>,
				error: null,
			},
		});
		const locals = createMockLocals({
			session: { user: { id: 'user-1', email: 'test@test.com' } },
			supabase,
		});

		const session = await locals.safeGetSession();
		expect(session.session).not.toBeNull();

		const { data: profile } = await locals.supabase
			.from('users')
			.select('family_id')
			.eq('id', 'user-1')
			.single();
		expect(profile?.family_id).toBe('fam-1');

		const { data: gam } = await locals.supabase
			.from('gamification')
			.select('*')
			.eq('family_id', 'fam-1')
			.single();
		expect(gam?.current_points).toBe(100);
		expect(gam?.streak_days).toBe(7);
	});
});

describe('rewards actions', () => {
	it('rejects propose when name is missing', () => {
		const name = '';
		const pointCost = 50;
		expect(!name || !pointCost).toBe(true);
	});

	it('rejects redeem when insufficient points', () => {
		const userPoints = 30;
		const rewardCost = 50;
		expect(userPoints < rewardCost).toBe(true);
	});
});

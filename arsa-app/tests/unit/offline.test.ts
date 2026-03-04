import { describe, it, expect, beforeEach } from 'vitest';
import 'fake-indexeddb/auto';
import {
	initDB,
	resetDB,
	queueAction,
	getPendingActions,
	deletePendingAction,
	getPendingCount,
	setCachedData,
	getCachedData,
} from '$lib/offline';

describe('offline queue', () => {
	beforeEach(async () => {
		await resetDB();
		const { deleteDB } = await import('idb');
		await deleteDB('arsa-offline');
		await initDB();
	});

	it('queues an action and retrieves it', async () => {
		await queueAction('add_transaction', { amount: 50000, type: 'out' });
		const actions = await getPendingActions();
		expect(actions).toHaveLength(1);
		expect(actions[0].action_type).toBe('add_transaction');
		expect(actions[0].payload.amount).toBe(50000);
		expect(actions[0].retries).toBe(0);
	});

	it('returns pending count', async () => {
		await queueAction('add_transaction', { amount: 10000 });
		await queueAction('propose_reward', { name: 'Test' });
		const count = await getPendingCount();
		expect(count).toBe(2);
	});

	it('deletes a pending action by id', async () => {
		await queueAction('add_transaction', { amount: 10000 });
		const actions = await getPendingActions();
		await deletePendingAction(actions[0].id);
		const remaining = await getPendingActions();
		expect(remaining).toHaveLength(0);
	});

	it('stores and retrieves cached data', async () => {
		const data = { totalPoints: 100, streak: 5 };
		await setCachedData('gamification', data);
		const cached = await getCachedData('gamification');
		expect(cached).toEqual(data);
	});

	it('returns null for missing cached data', async () => {
		const cached = await getCachedData('nonexistent');
		expect(cached).toBeNull();
	});

	it('overwrites cached data on same key', async () => {
		await setCachedData('dashboard', { balance: 100 });
		await setCachedData('dashboard', { balance: 200 });
		const cached = await getCachedData('dashboard');
		expect(cached).toEqual({ balance: 200 });
	});
});

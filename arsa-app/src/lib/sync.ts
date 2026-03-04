import { browser } from '$app/environment';
import { getPendingActions, deletePendingAction, incrementRetries } from '$lib/offline';

const MAX_RETRIES = 3;

const ACTION_ENDPOINTS: Record<string, string> = {
	add_transaction: '/api/transactions',
	propose_reward: '/gamification/rewards?/propose'
};

export async function syncPendingActions(): Promise<{ synced: number; failed: number }> {
	if (!browser || !navigator.onLine) return { synced: 0, failed: 0 };

	const actions = await getPendingActions();
	let synced = 0;
	let failed = 0;

	for (const action of actions) {
		const endpoint = ACTION_ENDPOINTS[action.action_type];
		if (!endpoint) {
			await deletePendingAction(action.id);
			failed++;
			continue;
		}

		try {
			const formData = new FormData();
			for (const [key, value] of Object.entries(action.payload)) {
				formData.append(key, String(value));
			}

			const response = await fetch(endpoint, {
				method: 'POST',
				body: formData
			});

			if (response.ok || response.status === 303) {
				await deletePendingAction(action.id);
				synced++;
			} else if (action.retries >= MAX_RETRIES) {
				await deletePendingAction(action.id);
				failed++;
			} else {
				await incrementRetries(action.id);
				failed++;
			}
		} catch {
			if (action.retries >= MAX_RETRIES) {
				await deletePendingAction(action.id);
				failed++;
			} else {
				await incrementRetries(action.id);
			}
		}
	}

	return { synced, failed };
}

export function startSyncListener(
	onSync: (result: { synced: number; failed: number }) => void
): () => void {
	if (!browser) return () => {};

	const handler = async () => {
		const result = await syncPendingActions();
		if (result.synced > 0 || result.failed > 0) {
			onSync(result);
		}
	};

	const visibilityHandler = () => {
		if (document.visibilityState === 'visible' && navigator.onLine) {
			handler();
		}
	};

	window.addEventListener('online', handler);
	document.addEventListener('visibilitychange', visibilityHandler);

	return () => {
		window.removeEventListener('online', handler);
		document.removeEventListener('visibilitychange', visibilityHandler);
	};
}

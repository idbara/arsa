import { openDB, type IDBPDatabase } from 'idb';

interface PendingAction {
	id: number;
	action_type: string;
	payload: Record<string, unknown>;
	created_at: string;
	retries: number;
}

const DB_NAME = 'arsa-offline';
const DB_VERSION = 1;

let dbPromise: Promise<IDBPDatabase> | null = null;

export async function initDB(): Promise<IDBPDatabase> {
	if (!dbPromise) {
		dbPromise = openDB(DB_NAME, DB_VERSION, {
			upgrade(db) {
				if (!db.objectStoreNames.contains('pending_actions')) {
					db.createObjectStore('pending_actions', { keyPath: 'id', autoIncrement: true });
				}
				if (!db.objectStoreNames.contains('cached_data')) {
					db.createObjectStore('cached_data');
				}
			}
		});
	}
	return dbPromise;
}

export async function queueAction(
	actionType: string,
	payload: Record<string, unknown>
): Promise<void> {
	const db = await initDB();
	await db.add('pending_actions', {
		action_type: actionType,
		payload,
		created_at: new Date().toISOString(),
		retries: 0
	});
}

export async function getPendingActions(): Promise<PendingAction[]> {
	const db = await initDB();
	return db.getAll('pending_actions');
}

export async function deletePendingAction(id: number): Promise<void> {
	const db = await initDB();
	await db.delete('pending_actions', id);
}

export async function incrementRetries(id: number): Promise<void> {
	const db = await initDB();
	const action = await db.get('pending_actions', id);
	if (action) {
		action.retries += 1;
		await db.put('pending_actions', action);
	}
}

export async function getPendingCount(): Promise<number> {
	const db = await initDB();
	return db.count('pending_actions');
}

export async function setCachedData(key: string, data: unknown): Promise<void> {
	const db = await initDB();
	await db.put('cached_data', data, key);
}

export async function getCachedData<T = unknown>(key: string): Promise<T | null> {
	const db = await initDB();
	const result = await db.get('cached_data', key);
	return (result as T) ?? null;
}

export async function resetDB(): Promise<void> {
	if (dbPromise) {
		const db = await dbPromise;
		db.close();
		dbPromise = null;
	}
}

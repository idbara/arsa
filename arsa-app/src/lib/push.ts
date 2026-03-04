import { browser } from '$app/environment';

const PUSH_PROMPTED_KEY = 'arsa-push-prompted';

export function wasPushPrompted(): boolean {
	if (!browser) return true;
	return localStorage.getItem(PUSH_PROMPTED_KEY) === 'true';
}

export function markPushPrompted(): void {
	if (browser) localStorage.setItem(PUSH_PROMPTED_KEY, 'true');
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function subscribeToPush(
	supabase: any,
	userId: string,
	vapidPublicKey: string
): Promise<boolean> {
	if (!browser || !('serviceWorker' in navigator) || !('PushManager' in window)) return false;

	const permission = await Notification.requestPermission();
	if (permission !== 'granted') return false;

	const registration = await navigator.serviceWorker.ready;
	const subscription = await registration.pushManager.subscribe({
		userVisibleOnly: true,
		applicationServerKey: urlBase64ToUint8Array(vapidPublicKey).buffer as ArrayBuffer
	});

	const subJson = subscription.toJSON();
	const { error } = await supabase.from('push_subscriptions').insert({
		user_id: userId,
		endpoint: subJson.endpoint,
		keys: subJson.keys
	});

	return !error;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function unsubscribeFromPush(supabase: any, userId: string): Promise<void> {
	if (!browser || !('serviceWorker' in navigator)) return;

	const registration = await navigator.serviceWorker.ready;
	const subscription = await registration.pushManager.getSubscription();
	if (subscription) {
		await subscription.unsubscribe();
	}

	await supabase.from('push_subscriptions').delete().eq('user_id', userId);
}

function urlBase64ToUint8Array(base64String: string): Uint8Array {
	const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
	const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
	const rawData = atob(base64);
	const outputArray = new Uint8Array(rawData.length);
	for (let i = 0; i < rawData.length; i++) {
		outputArray[i] = rawData.charCodeAt(i);
	}
	return outputArray;
}

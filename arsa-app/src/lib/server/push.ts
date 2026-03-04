import { env } from '$env/dynamic/private';
import { env as publicEnv } from '$env/dynamic/public';

interface PushSubscriptionRecord {
	endpoint: string;
	keys: { p256dh: string; auth: string };
}

interface PushPayload {
	title: string;
	body: string;
	icon?: string;
	url?: string;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type SupabaseClient = any;

export async function sendPushNotification(
	subscription: PushSubscriptionRecord,
	payload: PushPayload
): Promise<boolean> {
	try {
		const vapidPrivateKey = env.VAPID_PRIVATE_KEY;
		const vapidPublicKey = publicEnv.PUBLIC_VAPID_PUBLIC_KEY;
		if (!vapidPrivateKey || !vapidPublicKey) return false;

		const jwt = await createVapidJwt(subscription.endpoint, vapidPrivateKey);

		const response = await fetch(subscription.endpoint, {
			method: 'POST',
			headers: {
				'Content-Type': 'application/json',
				Authorization: `vapid t=${jwt}, k=${vapidPublicKey}`,
				TTL: '86400'
			},
			body: JSON.stringify(payload)
		});

		return response.ok || response.status === 201;
	} catch {
		return false;
	}
}

export async function sendPushToUser(
	supabase: SupabaseClient,
	userId: string,
	payload: PushPayload
): Promise<number> {
	const { data: subs } = await supabase
		.from('push_subscriptions')
		.select('endpoint, keys')
		.eq('user_id', userId);

	let sent = 0;
	for (const sub of (subs ?? []) as unknown as PushSubscriptionRecord[]) {
		const ok = await sendPushNotification(sub, payload);
		if (ok) sent++;
	}
	return sent;
}

export async function sendPushToFamilyAdmins(
	supabase: SupabaseClient,
	familyId: string,
	payload: PushPayload
): Promise<number> {
	const { data: admins } = await supabase.from('users').select('id').eq('family_id', familyId);

	let sent = 0;
	for (const admin of (admins ?? []) as unknown as { id: string }[]) {
		sent += await sendPushToUser(supabase, admin.id, payload);
	}
	return sent;
}

async function createVapidJwt(endpoint: string, privateKeyBase64: string): Promise<string> {
	const audience = new URL(endpoint).origin;
	const header = base64url(JSON.stringify({ typ: 'JWT', alg: 'ES256' }));

	const now = Math.floor(Date.now() / 1000);
	const payload = base64url(
		JSON.stringify({
			aud: audience,
			exp: now + 86400,
			sub: 'mailto:arsa@example.com'
		})
	);

	const unsigned = `${header}.${payload}`;

	const keyData = urlBase64ToArrayBuffer(privateKeyBase64);
	const key = await crypto.subtle.importKey(
		'pkcs8',
		keyData,
		{ name: 'ECDSA', namedCurve: 'P-256' },
		false,
		['sign']
	);

	const signature = await crypto.subtle.sign(
		{ name: 'ECDSA', hash: 'SHA-256' },
		key,
		new TextEncoder().encode(unsigned)
	);

	const sig = arrayBufferToBase64url(signature);
	return `${unsigned}.${sig}`;
}

function base64url(str: string): string {
	return btoa(str).replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '');
}

function urlBase64ToArrayBuffer(base64: string): ArrayBuffer {
	const padding = '='.repeat((4 - (base64.length % 4)) % 4);
	const raw = atob((base64 + padding).replace(/-/g, '+').replace(/_/g, '/'));
	const buffer = new Uint8Array(raw.length);
	for (let i = 0; i < raw.length; i++) buffer[i] = raw.charCodeAt(i);
	return buffer.buffer;
}

function arrayBufferToBase64url(buffer: ArrayBuffer): string {
	const bytes = new Uint8Array(buffer);
	let binary = '';
	for (const byte of bytes) binary += String.fromCharCode(byte);
	return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '');
}

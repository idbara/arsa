import { createClient } from '@supabase/supabase-js';

interface Env {
	SUPABASE_URL: string;
	SUPABASE_SERVICE_ROLE_KEY: string;
	VAPID_PRIVATE_KEY: string;
	VAPID_PUBLIC_KEY: string;
	WORKER_SECRET: string;
}

interface DueSubscription {
	id: string;
	name: string;
	amount: number;
	frequency: string;
	next_due_date: string;
	user_id: string;
}

interface PushSub {
	endpoint: string;
	keys: { p256dh: string; auth: string };
}

export default {
	async scheduled(_event: ScheduledEvent, env: Env, ctx: ExecutionContext): Promise<void> {
		ctx.waitUntil(processReminders(env));
	},

	async fetch(request: Request, env: Env): Promise<Response> {
		if (request.headers.get('X-Worker-Secret') !== env.WORKER_SECRET) {
			return new Response('Unauthorized', { status: 401 });
		}
		const result = await processReminders(env);
		return new Response(JSON.stringify(result, null, 2), {
			headers: { 'Content-Type': 'application/json' }
		});
	}
};

async function processReminders(env: Env): Promise<Record<string, unknown>> {
	const supabase = createClient(env.SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY);
	const today = new Date().toISOString().split('T')[0];

	const { data: dueSubs, error } = await supabase
		.from('subscriptions')
		.select('id, name, amount, frequency, next_due_date, user_id')
		.eq('is_active', true)
		.lte('next_due_date', today);

	if (error || !dueSubs) {
		return { error: error?.message ?? 'No data', processed: 0 };
	}

	let notified = 0;
	let advanced = 0;

	for (const sub of dueSubs as DueSubscription[]) {
		const { data: pushSubs } = await supabase
			.from('push_subscriptions')
			.select('endpoint, keys')
			.eq('user_id', sub.user_id);

		const payload = JSON.stringify({
			title: `Langganan ${sub.name}`,
			body: `Jatuh tempo hari ini — Rp ${Number(sub.amount).toLocaleString('id-ID')}`,
			icon: '/icons/icon-192.png',
			url: '/plan/subscriptions'
		});

		for (const ps of (pushSubs ?? []) as PushSub[]) {
			try {
				await fetch(ps.endpoint, {
					method: 'POST',
					headers: { 'Content-Type': 'application/json', TTL: '86400' },
					body: payload
				});
				notified++;
			} catch {
				// non-critical
			}
		}

		// Advance next_due_date until it's in the future
		let nextDue = new Date(sub.next_due_date + 'T00:00:00');
		const todayDate = new Date(today + 'T00:00:00');
		while (nextDue <= todayDate) {
			nextDue = advanceDate(nextDue, sub.frequency);
		}

		await supabase
			.from('subscriptions')
			.update({
				next_due_date: nextDue.toISOString().split('T')[0],
				updated_at: new Date().toISOString()
			})
			.eq('id', sub.id);

		advanced++;
	}

	return { processed: dueSubs.length, notified, advanced };
}

function advanceDate(date: Date, frequency: string): Date {
	const d = new Date(date);
	switch (frequency) {
		case 'daily':
			d.setDate(d.getDate() + 1);
			break;
		case 'weekly':
			d.setDate(d.getDate() + 7);
			break;
		case 'monthly':
			d.setMonth(d.getMonth() + 1);
			break;
		case 'quarterly':
			d.setMonth(d.getMonth() + 3);
			break;
		case 'semi_annual':
			d.setMonth(d.getMonth() + 6);
			break;
		case 'annual':
			d.setFullYear(d.getFullYear() + 1);
			break;
	}
	return d;
}

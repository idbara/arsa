import { createClient } from '@supabase/supabase-js';
import { evaluateFamily } from './evaluate';
import { buildReportData, buildEmailHtml, sendReport } from './email';

export interface Env {
	SUPABASE_URL: string;
	SUPABASE_SERVICE_ROLE_KEY: string;
	RESEND_API_KEY: string;
	WORKER_SECRET: string;
}

export default {
	async scheduled(event: ScheduledEvent, env: Env, ctx: ExecutionContext): Promise<void> {
		ctx.waitUntil(runMonthlyJob(env));
	},

	async fetch(request: Request, env: Env): Promise<Response> {
		const secret = request.headers.get('X-Worker-Secret');
		if (secret !== env.WORKER_SECRET) {
			return new Response('Unauthorized', { status: 401 });
		}
		const result = await runMonthlyJob(env);
		return new Response(JSON.stringify(result, null, 2), {
			headers: { 'Content-Type': 'application/json' }
		});
	}
};

async function runMonthlyJob(env: Env): Promise<Record<string, unknown>> {
	const supabase = createClient(env.SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY);
	const now = new Date();
	const targetMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);
	const monthNames = [
		'Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni',
		'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'
	];

	const { data: families, error: famError } = await supabase
		.from('families')
		.select('id, name');

	if (famError || !families) {
		return { error: `Failed to fetch families: ${famError?.message}` };
	}

	const results: Record<string, unknown> = {};

	for (const family of families) {
		try {
			const evalResult = await evaluateFamily(supabase, family, targetMonth);

			const reportData = await buildReportData(supabase, family.id, targetMonth);
			const html = buildEmailHtml(reportData);

			const { data: users } = await supabase
				.from('users')
				.select('id')
				.eq('family_id', family.id);

			const emails: string[] = [];
			for (const user of users ?? []) {
				const { data: authUser } = await supabase.auth.admin.getUserById(user.id);
				if (authUser?.user?.email) emails.push(authUser.user.email);
			}

			if (emails.length > 0) {
				const subject = `Laporan Keluarga ${family.name} — ${monthNames[targetMonth.getMonth()]} ${targetMonth.getFullYear()}`;
				await sendReport(env.RESEND_API_KEY, emails, subject, html);
			}

			// Send push notifications to family members
			const { data: pushSubs } = await supabase
				.from('push_subscriptions')
				.select('endpoint, keys, user_id')
				.in('user_id', (users ?? []).map(u => u.id));

			for (const sub of pushSubs ?? []) {
				try {
					await fetch(sub.endpoint as string, {
						method: 'POST',
						headers: {
							'Content-Type': 'application/json',
							'TTL': '86400',
						},
						body: JSON.stringify({
							title: 'Monthly Report Ready',
							body: `Laporan ${monthNames[targetMonth.getMonth()]} ${targetMonth.getFullYear()} sudah dikirim ke email`,
							icon: '/icons/icon-192.png',
							url: '/',
						}),
					});
				} catch {
					// non-critical, continue
				}
			}

			results[family.id] = {
				name: family.name,
				pointsAwarded: evalResult.pointsAwarded,
				errors: evalResult.errors,
				emailsSent: emails.length
			};
		} catch (e: unknown) {
			results[family.id] = {
				name: family.name,
				error: e instanceof Error ? e.message : String(e)
			};
		}
	}

	return { processed: families.length, results };
}

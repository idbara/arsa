import type { SupabaseClient } from '@supabase/supabase-js';

interface Family {
	id: string;
	name: string;
}

interface User {
	id: string;
	family_id: string;
	display_name: string;
}

interface PointRule {
	id: string;
	family_id: string;
	rule_type: string;
	points_value: number;
	config: Record<string, unknown>;
	is_active: boolean;
}

export async function evaluateFamily(
	supabase: SupabaseClient,
	family: Family,
	targetMonth: Date
): Promise<{ pointsAwarded: number; errors: string[] }> {
	const errors: string[] = [];
	let pointsAwarded = 0;

	const monthStr = targetMonth.toISOString().split('T')[0];
	const monthStart = new Date(targetMonth.getFullYear(), targetMonth.getMonth(), 1);
	const monthEnd = new Date(targetMonth.getFullYear(), targetMonth.getMonth() + 1, 0);

	const { data: users } = await supabase
		.from('users')
		.select('id, family_id, display_name')
		.eq('family_id', family.id);

	if (!users || users.length === 0) return { pointsAwarded, errors };

	const { data: rules } = await supabase
		.from('point_rules')
		.select('*')
		.eq('family_id', family.id)
		.eq('is_active', true);

	if (!rules || rules.length === 0) return { pointsAwarded, errors };

	for (const rule of rules as PointRule[]) {
		try {
			const awarded = await evaluateRule(
				supabase, rule, users, family.id, monthStr, monthStart, monthEnd
			);
			pointsAwarded += awarded;
		} catch (e: unknown) {
			errors.push(`Rule ${rule.id}: ${e instanceof Error ? e.message : String(e)}`);
		}
	}

	for (const user of users) {
		const { data: totalData } = await supabase
			.from('point_events')
			.select('points')
			.eq('family_id', family.id)
			.eq('user_id', user.id);

		const total = (totalData ?? []).reduce(
			(sum: number, e: { points: number }) => sum + e.points, 0
		);

		await supabase
			.from('gamification')
			.upsert(
				{ family_id: family.id, user_id: user.id, current_points: total },
				{ onConflict: 'family_id,user_id' }
			);
	}

	await updateStreaks(supabase, family.id, users, monthEnd);

	return { pointsAwarded, errors };
}

async function evaluateRule(
	supabase: SupabaseClient,
	rule: PointRule,
	users: User[],
	familyId: string,
	monthStr: string,
	monthStart: Date,
	monthEnd: Date
): Promise<number> {
	let awarded = 0;

	switch (rule.rule_type) {
		case 'budget_discipline': {
			const categoryId = rule.config.category_id as string;
			if (!categoryId) break;

			const { data: category } = await supabase
				.from('categories')
				.select('monthly_limit')
				.eq('id', categoryId)
				.single();

			if (!category?.monthly_limit) break;

			const { data: txns } = await supabase
				.from('transactions')
				.select('amount')
				.eq('family_id', familyId)
				.eq('category_id', categoryId)
				.eq('type', 'out')
				.gte('date', monthStart.toISOString().split('T')[0])
				.lte('date', monthEnd.toISOString().split('T')[0]);

			const totalSpend = (txns ?? []).reduce(
				(sum: number, t: { amount: number }) => sum + Number(t.amount), 0
			);

			if (totalSpend < Number(category.monthly_limit)) {
				for (const user of users) {
					const inserted = await insertPointEvent(supabase, {
						family_id: familyId,
						user_id: user.id,
						rule_id: rule.id,
						points: rule.points_value,
						description: 'Budget discipline: stayed under limit',
						month: monthStr
					});
					if (inserted) awarded += rule.points_value;
				}
			}
			break;
		}

		case 'daily_logging': {
			const milestones = (rule.config.streak_milestones as number[]) ?? [7, 14, 30];
			for (const user of users) {
				const { data: txns } = await supabase
					.from('transactions')
					.select('date')
					.eq('user_id', user.id)
					.eq('family_id', familyId)
					.gte('date', monthStart.toISOString().split('T')[0])
					.lte('date', monthEnd.toISOString().split('T')[0]);

				const uniqueDays = new Set((txns ?? []).map((t: { date: string }) => t.date));
				const logDays = uniqueDays.size;

				for (const milestone of milestones) {
					if (logDays >= milestone) {
						const inserted = await insertPointEvent(supabase, {
							family_id: familyId,
							user_id: user.id,
							rule_id: rule.id,
							points: rule.points_value * (milestone / 7),
							description: `Logging streak: ${milestone} days`,
							month: monthStr
						});
						if (inserted) awarded += rule.points_value * (milestone / 7);
					}
				}
			}
			break;
		}

		case 'savings_milestone': {
			const accountId = rule.config.account_id as string;
			const targetBalance = rule.config.target_balance as number;
			if (!accountId || !targetBalance) break;

			const { data: account } = await supabase
				.from('accounts')
				.select('balance')
				.eq('id', accountId)
				.single();

			if (account && Number(account.balance) >= targetBalance) {
				for (const user of users) {
					const inserted = await insertPointEvent(supabase, {
						family_id: familyId,
						user_id: user.id,
						rule_id: rule.id,
						points: rule.points_value,
						description: 'Savings milestone reached',
						month: monthStr
					});
					if (inserted) awarded += rule.points_value;
				}
			}
			break;
		}

		case 'custom_challenge': {
			const verify = rule.config.verify as string;
			if (verify === 'auto_category') {
				const categoryId = rule.config.category_id as string;
				const deadline = rule.config.deadline as string;
				if (!categoryId || !deadline) break;

				const { data: txns } = await supabase
					.from('transactions')
					.select('id')
					.eq('family_id', familyId)
					.eq('category_id', categoryId)
					.eq('type', 'out')
					.gte('date', monthStart.toISOString().split('T')[0])
					.lte('date', deadline);

				if (!txns || txns.length === 0) {
					for (const user of users) {
						const inserted = await insertPointEvent(supabase, {
							family_id: familyId,
							user_id: user.id,
							rule_id: rule.id,
							points: rule.points_value,
							description: `Challenge completed: ${rule.config.name ?? 'custom'}`,
							month: monthStr
						});
						if (inserted) awarded += rule.points_value;
					}
				}
			}
			break;
		}
	}

	return awarded;
}

async function insertPointEvent(
	supabase: SupabaseClient,
	event: {
		family_id: string;
		user_id: string;
		rule_id: string;
		points: number;
		description: string;
		month: string;
	}
): Promise<boolean> {
	const { error } = await supabase.from('point_events').insert(event);
	if (error?.code === '23505') return false;
	if (error) throw new Error(error.message);
	return true;
}

async function updateStreaks(
	supabase: SupabaseClient,
	familyId: string,
	users: User[],
	_monthEnd: Date
): Promise<void> {
	for (const user of users) {
		const { data: txns } = await supabase
			.from('transactions')
			.select('date')
			.eq('user_id', user.id)
			.eq('family_id', familyId)
			.order('date', { ascending: false })
			.limit(60);

		if (!txns || txns.length === 0) {
			await supabase
				.from('gamification')
				.update({ streak_days: 0, last_log_date: null })
				.eq('family_id', familyId)
				.eq('user_id', user.id);
			continue;
		}

		const dates = [...new Set(txns.map((t: { date: string }) => t.date))].sort().reverse();
		let streak = 1;
		for (let i = 1; i < dates.length; i++) {
			const curr = new Date(dates[i - 1]);
			const prev = new Date(dates[i]);
			const diffDays = (curr.getTime() - prev.getTime()) / (1000 * 60 * 60 * 24);
			if (diffDays === 1) {
				streak++;
			} else {
				break;
			}
		}

		await supabase
			.from('gamification')
			.update({ streak_days: streak, last_log_date: dates[0] })
			.eq('family_id', familyId)
			.eq('user_id', user.id);
	}
}

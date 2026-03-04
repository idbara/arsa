import type { SupabaseClient } from '@supabase/supabase-js';

interface ReportData {
	familyName: string;
	month: string;
	year: number;
	totalIncome: number;
	totalExpense: number;
	netSavings: number;
	prevMonthExpense: number;
	categories: { name: string; limit: number | null; spent: number }[];
	memberSpending: { name: string; spent: number }[];
	investments: {
		asset_code: string;
		asset_type: string;
		qty: number;
		avg_buy_price: number;
		current_price: number;
	}[];
	leaderboard: {
		name: string;
		points_this_month: number;
		total_points: number;
		streak: number;
	}[];
	redemptions: { name: string; reward_name: string }[];
	highlights: string[];
}

const MONTH_NAMES = [
	'Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni',
	'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'
];

export async function buildReportData(
	supabase: SupabaseClient,
	familyId: string,
	targetMonth: Date
): Promise<ReportData> {
	const monthStart = new Date(targetMonth.getFullYear(), targetMonth.getMonth(), 1);
	const monthEnd = new Date(targetMonth.getFullYear(), targetMonth.getMonth() + 1, 0);
	const prevMonthStart = new Date(targetMonth.getFullYear(), targetMonth.getMonth() - 1, 1);
	const prevMonthEnd = new Date(targetMonth.getFullYear(), targetMonth.getMonth(), 0);
	const monthStr = monthStart.toISOString().split('T')[0];

	const { data: family } = await supabase
		.from('families')
		.select('name')
		.eq('id', familyId)
		.single();

	const { data: txns } = await supabase
		.from('transactions')
		.select('amount, type, category_id, user_id, merchant, is_private')
		.eq('family_id', familyId)
		.gte('date', monthStart.toISOString().split('T')[0])
		.lte('date', monthEnd.toISOString().split('T')[0]);

	const { data: prevTxns } = await supabase
		.from('transactions')
		.select('amount, type')
		.eq('family_id', familyId)
		.gte('date', prevMonthStart.toISOString().split('T')[0])
		.lte('date', prevMonthEnd.toISOString().split('T')[0]);

	const { data: categories } = await supabase
		.from('categories')
		.select('id, name, monthly_limit')
		.eq('family_id', familyId);

	const { data: users } = await supabase
		.from('users')
		.select('id, display_name')
		.eq('family_id', familyId);

	const { data: investments } = await supabase
		.from('investments')
		.select('asset_code, qty, avg_buy_price')
		.eq('family_id', familyId);

	const { data: marketRates } = await supabase
		.from('market_rates')
		.select('asset_code, asset_type, buy_price, sell_price');

	const { data: gamData } = await supabase
		.from('gamification')
		.select('user_id, current_points, streak_days')
		.eq('family_id', familyId);

	const { data: pointEvents } = await supabase
		.from('point_events')
		.select('user_id, points')
		.eq('family_id', familyId)
		.eq('month', monthStr);

	const { data: redemptions } = await supabase
		.from('reward_redemptions')
		.select('redeemed_by, rewards(name)')
		.eq('family_id', familyId)
		.gte('redeemed_at', monthStart.toISOString())
		.lte('redeemed_at', monthEnd.toISOString());

	const allTxns = txns ?? [];
	const totalIncome = allTxns
		.filter((t: { type: string }) => t.type === 'in')
		.reduce((s: number, t: { amount: number }) => s + Number(t.amount), 0);
	const totalExpense = allTxns
		.filter((t: { type: string }) => t.type === 'out')
		.reduce((s: number, t: { amount: number }) => s + Number(t.amount), 0);
	const prevMonthExpense = (prevTxns ?? [])
		.filter((t: { type: string }) => t.type === 'out')
		.reduce((s: number, t: { amount: number }) => s + Number(t.amount), 0);

	const catSpend: Record<string, number> = {};
	for (const t of allTxns.filter(
		(t: { type: string; category_id: string }) => t.type === 'out' && t.category_id
	)) {
		catSpend[t.category_id] = (catSpend[t.category_id] ?? 0) + Number(t.amount);
	}

	const categoryReport = (categories ?? [])
		.map((c: { id: string; name: string; monthly_limit: number | null }) => ({
			name: c.name,
			limit: c.monthly_limit ? Number(c.monthly_limit) : null,
			spent: catSpend[c.id] ?? 0
		}))
		.sort((a, b) => b.spent - a.spent);

	const userMap = new Map(
		(users ?? []).map((u: { id: string; display_name: string }) => [u.id, u.display_name])
	);
	const memberSpend: Record<string, number> = {};
	for (const t of allTxns.filter((t: { type: string }) => t.type === 'out')) {
		memberSpend[t.user_id] = (memberSpend[t.user_id] ?? 0) + Number(t.amount);
	}
	const memberSpending = (users ?? []).map((u: { id: string; display_name: string }) => ({
		name: u.display_name,
		spent: memberSpend[u.id] ?? 0
	}));

	const rateMap = new Map(
		(marketRates ?? []).map((r: { asset_code: string }) => [r.asset_code, r])
	);
	const investmentReport = (investments ?? []).map(
		(inv: { asset_code: string; qty: number; avg_buy_price: number }) => {
			const rate = rateMap.get(inv.asset_code) as
				| { asset_type: string; sell_price: number }
				| undefined;
			return {
				asset_code: inv.asset_code,
				asset_type: rate?.asset_type ?? 'unknown',
				qty: Number(inv.qty),
				avg_buy_price: Number(inv.avg_buy_price),
				current_price: rate ? Number(rate.sell_price) : 0
			};
		}
	);

	const pointsByUser: Record<string, number> = {};
	for (const pe of pointEvents ?? []) {
		pointsByUser[pe.user_id] = (pointsByUser[pe.user_id] ?? 0) + pe.points;
	}

	const leaderboard = (gamData ?? [])
		.map((g: { user_id: string; current_points: number; streak_days: number }) => ({
			name: userMap.get(g.user_id) ?? 'Unknown',
			points_this_month: pointsByUser[g.user_id] ?? 0,
			total_points: g.current_points,
			streak: g.streak_days
		}))
		.sort((a, b) => b.points_this_month - a.points_this_month);

	const redemptionReport = (redemptions ?? []).map(
		(r: { redeemed_by: string; rewards: { name: string } | null }) => ({
			name: userMap.get(r.redeemed_by) ?? 'Unknown',
			reward_name: r.rewards?.name ?? 'Unknown reward'
		})
	);

	const highlights: string[] = [];
	const biggestExpense = allTxns
		.filter((t: { type: string }) => t.type === 'out')
		.sort(
			(a: { amount: number }, b: { amount: number }) => Number(b.amount) - Number(a.amount)
		)[0] as { amount: number; is_private: boolean; merchant: string | null } | undefined;

	if (biggestExpense) {
		const merchant = biggestExpense.is_private
			? 'Private'
			: (biggestExpense.merchant ?? 'Unknown');
		highlights.push(
			`Pengeluaran terbesar: Rp${Number(biggestExpense.amount).toLocaleString('id-ID')} (${merchant})`
		);
	}

	const bestCategory = categoryReport.find((c) => c.limit && c.spent < c.limit);
	if (bestCategory && bestCategory.limit) {
		highlights.push(
			`Kategori terbaik: ${bestCategory.name} (${Math.round((bestCategory.spent / bestCategory.limit) * 100)}% dari budget)`
		);
	}

	const topStreak = [...leaderboard].sort((a, b) => b.streak - a.streak)[0];
	if (topStreak && topStreak.streak > 0) {
		highlights.push(`Streak terpanjang: ${topStreak.name} (${topStreak.streak} hari)`);
	}

	return {
		familyName: family?.name ?? 'Keluarga',
		month: MONTH_NAMES[targetMonth.getMonth()],
		year: targetMonth.getFullYear(),
		totalIncome,
		totalExpense,
		netSavings: totalIncome - totalExpense,
		prevMonthExpense,
		categories: categoryReport,
		memberSpending,
		investments: investmentReport,
		leaderboard,
		redemptions: redemptionReport,
		highlights
	};
}

export function formatRp(n: number): string {
	return `Rp${n.toLocaleString('id-ID')}`;
}

export function changeIndicator(current: number, previous: number): string {
	if (previous === 0) return '';
	const pct = Math.round(((current - previous) / previous) * 100);
	if (pct > 0) return ` ↑${pct}%`;
	if (pct < 0) return ` ↓${Math.abs(pct)}%`;
	return '';
}

export function progressBar(pct: number): string {
	const filled = Math.min(Math.round(pct / 10), 10);
	return '█'.repeat(filled) + '░'.repeat(10 - filled);
}

export function buildEmailHtml(data: ReportData): string {
	const investmentRows = data.investments
		.map((inv) => {
			const value = inv.qty * inv.current_price;
			const cost = inv.qty * inv.avg_buy_price;
			const pl = value - cost;
			const plColor = pl >= 0 ? '#22c55e' : '#ef4444';
			return `<tr>
      <td style="padding:4px 8px">${inv.asset_code}</td>
      <td style="padding:4px 8px">${inv.qty}</td>
      <td style="padding:4px 8px">${formatRp(inv.current_price)}</td>
      <td style="padding:4px 8px;color:${plColor}">${pl >= 0 ? '+' : ''}${formatRp(pl)}</td>
    </tr>`;
		})
		.join('');

	const categoryRows = data.categories
		.map((c) => {
			const pct = c.limit ? Math.round((c.spent / c.limit) * 100) : 0;
			const status = c.limit ? (c.spent > c.limit ? '🔴' : '🟢') : '-';
			return `<tr>
      <td style="padding:4px 8px">${c.name}</td>
      <td style="padding:4px 8px">${c.limit ? formatRp(c.limit) : '-'}</td>
      <td style="padding:4px 8px">${formatRp(c.spent)}</td>
      <td style="padding:4px 8px">${c.limit ? `${progressBar(pct)} ${pct}%` : '-'}</td>
      <td style="padding:4px 8px">${status}</td>
    </tr>`;
		})
		.join('');

	const memberRows = data.memberSpending
		.map(
			(m) =>
				`<tr><td style="padding:4px 8px">${m.name}</td><td style="padding:4px 8px">${formatRp(m.spent)}</td></tr>`
		)
		.join('');

	const leaderboardRows = data.leaderboard
		.map(
			(l, i) =>
				`<tr>
      <td style="padding:4px 8px">${i + 1}</td>
      <td style="padding:4px 8px">${l.name}</td>
      <td style="padding:4px 8px;color:#22c55e">+${l.points_this_month}</td>
      <td style="padding:4px 8px">${l.total_points}</td>
      <td style="padding:4px 8px">${l.streak > 0 ? `${l.streak}d` : '-'}</td>
    </tr>`
		)
		.join('');

	const redemptionItems =
		data.redemptions.length > 0
			? data.redemptions.map((r) => `<li>${r.name} → ${r.reward_name}</li>`).join('')
			: '<li>Tidak ada reward ditukar bulan ini</li>';

	const highlightItems = data.highlights.map((h) => `<li>${h}</li>`).join('');

	return `<!DOCTYPE html>
<html>
<head><meta charset="utf-8"></head>
<body style="font-family:Arial,sans-serif;background:#f5f5f5;margin:0;padding:20px">
<table width="100%" cellpadding="0" cellspacing="0" style="max-width:600px;margin:0 auto;background:#fff;border-radius:8px;overflow:hidden">

  <tr><td style="background:#1a1a2e;color:#fff;padding:24px;text-align:center">
    <h1 style="margin:0;font-size:22px">Laporan Keluarga ${data.familyName}</h1>
    <p style="margin:4px 0 0;opacity:0.8">${data.month} ${data.year}</p>
  </td></tr>

  <tr><td style="padding:20px">
    <h2 style="font-size:16px;margin:0 0 12px;border-bottom:2px solid #eee;padding-bottom:8px">Ringkasan Cashflow</h2>
    <table width="100%">
      <tr><td>Pemasukan</td><td style="text-align:right;color:#22c55e;font-weight:bold">${formatRp(data.totalIncome)}</td></tr>
      <tr><td>Pengeluaran</td><td style="text-align:right;color:#ef4444;font-weight:bold">${formatRp(data.totalExpense)}${changeIndicator(data.totalExpense, data.prevMonthExpense)}</td></tr>
      <tr><td style="border-top:1px solid #eee;padding-top:8px"><strong>Tabungan Bersih</strong></td>
        <td style="text-align:right;border-top:1px solid #eee;padding-top:8px;font-weight:bold;color:${data.netSavings >= 0 ? '#22c55e' : '#ef4444'}">${formatRp(data.netSavings)}</td></tr>
    </table>
  </td></tr>

  <tr><td style="padding:0 20px 20px">
    <h2 style="font-size:16px;margin:0 0 12px;border-bottom:2px solid #eee;padding-bottom:8px">Pengeluaran per Kategori</h2>
    <table width="100%" style="font-size:13px">
      <tr style="background:#f0f0f0"><th style="padding:4px 8px;text-align:left">Kategori</th><th style="padding:4px 8px;text-align:left">Budget</th><th style="padding:4px 8px;text-align:left">Aktual</th><th style="padding:4px 8px;text-align:left">Progress</th><th style="padding:4px 8px">Status</th></tr>
      ${categoryRows}
    </table>
  </td></tr>

  <tr><td style="padding:0 20px 20px">
    <h2 style="font-size:16px;margin:0 0 12px;border-bottom:2px solid #eee;padding-bottom:8px">Pengeluaran per Anggota</h2>
    <table width="100%" style="font-size:13px">
      <tr style="background:#f0f0f0"><th style="padding:4px 8px;text-align:left">Anggota</th><th style="padding:4px 8px;text-align:left">Total</th></tr>
      ${memberRows}
    </table>
  </td></tr>

  ${
		data.investments.length > 0
			? `
  <tr><td style="padding:0 20px 20px">
    <h2 style="font-size:16px;margin:0 0 12px;border-bottom:2px solid #eee;padding-bottom:8px">Performa Investasi</h2>
    <table width="100%" style="font-size:13px">
      <tr style="background:#f0f0f0"><th style="padding:4px 8px;text-align:left">Aset</th><th style="padding:4px 8px;text-align:left">Qty</th><th style="padding:4px 8px;text-align:left">Harga</th><th style="padding:4px 8px;text-align:left">P/L</th></tr>
      ${investmentRows}
    </table>
  </td></tr>`
			: ''
	}

  <tr><td style="padding:0 20px 20px">
    <h2 style="font-size:16px;margin:0 0 12px;border-bottom:2px solid #eee;padding-bottom:8px">Leaderboard Gamifikasi</h2>
    <table width="100%" style="font-size:13px">
      <tr style="background:#f0f0f0"><th style="padding:4px 8px">#</th><th style="padding:4px 8px;text-align:left">Anggota</th><th style="padding:4px 8px">Bulan Ini</th><th style="padding:4px 8px">Total</th><th style="padding:4px 8px">Streak</th></tr>
      ${leaderboardRows}
    </table>
    <p style="font-size:12px;color:#888;margin:8px 0 0">Reward ditukar:</p>
    <ul style="font-size:12px;color:#666;margin:4px 0 0;padding-left:20px">${redemptionItems}</ul>
  </td></tr>

  ${
		data.highlights.length > 0
			? `
  <tr><td style="padding:0 20px 20px">
    <h2 style="font-size:16px;margin:0 0 12px;border-bottom:2px solid #eee;padding-bottom:8px">Highlights</h2>
    <ul style="font-size:13px;color:#333;padding-left:20px">${highlightItems}</ul>
  </td></tr>`
			: ''
	}

  <tr><td style="background:#f0f0f0;padding:16px;text-align:center;font-size:12px;color:#888">
    Generated by Arsa — Family Wealth & Lifestyle Manager
  </td></tr>

</table>
</body>
</html>`;
}

export async function sendReport(
	resendApiKey: string,
	to: string[],
	subject: string,
	html: string
): Promise<void> {
	const res = await fetch('https://api.resend.com/emails', {
		method: 'POST',
		headers: {
			Authorization: `Bearer ${resendApiKey}`,
			'Content-Type': 'application/json'
		},
		body: JSON.stringify({
			from: 'Arsa <arsa@resend.dev>',
			to,
			subject,
			html
		})
	});

	if (!res.ok) {
		const body = await res.text();
		throw new Error(`Resend API error ${res.status}: ${body}`);
	}
}

import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';

export const POST: RequestHandler = async ({ request, locals: { supabase, safeGetSession } }) => {
	const { user } = await safeGetSession();
	if (!user) error(401, 'Unauthorized');

	const { data: profile } = await supabase
		.from('users')
		.select('family_id, role')
		.eq('id', user.id)
		.single();

	if (!profile?.family_id) error(403, 'No family');

	const body = await request.json();
	const { action, asset_code, asset_type, qty, price } = body;

	if (!action || !asset_code || !qty || !price) {
		error(400, 'Missing required fields');
	}

	if (qty <= 0 || price <= 0) {
		error(400, 'Quantity and price must be positive');
	}

	const familyId = profile.family_id;

	if (action === 'buy') {
		const { data: existing } = await supabase
			.from('investments')
			.select('id, qty, avg_buy_price')
			.eq('family_id', familyId)
			.eq('asset_code', asset_code)
			.single();

		if (existing) {
			const oldQty = Number(existing.qty);
			const oldAvg = Number(existing.avg_buy_price);
			const newQty = oldQty + qty;
			const newAvg = (oldQty * oldAvg + qty * price) / newQty;

			const { error: updateErr } = await supabase
				.from('investments')
				.update({ qty: newQty, avg_buy_price: newAvg })
				.eq('id', existing.id);

			if (updateErr) error(500, updateErr.message);
		} else {
			if (asset_type) {
				await supabase
					.from('market_rates')
					.upsert(
						{ asset_code, asset_type, buy_price: price, sell_price: price },
						{ onConflict: 'asset_code' }
					);
			}

			const { error: insertErr } = await supabase.from('investments').insert({
				family_id: familyId,
				asset_code,
				qty,
				avg_buy_price: price
			});

			if (insertErr) error(500, insertErr.message);
		}

		return json({ success: true });
	}

	if (action === 'sell') {
		const { data: existing } = await supabase
			.from('investments')
			.select('id, qty, avg_buy_price')
			.eq('family_id', familyId)
			.eq('asset_code', asset_code)
			.single();

		if (!existing) error(404, 'No holding found');

		const currentQty = Number(existing!.qty);
		if (qty > currentQty) {
			error(400, `Cannot sell more than current holding (${currentQty})`);
		}

		const remainingQty = currentQty - qty;

		if (remainingQty === 0) {
			const { error: deleteErr } = await supabase
				.from('investments')
				.delete()
				.eq('id', existing!.id);

			if (deleteErr) error(500, deleteErr.message);
		} else {
			const { error: updateErr } = await supabase
				.from('investments')
				.update({ qty: remainingQty })
				.eq('id', existing!.id);

			if (updateErr) error(500, updateErr.message);
		}

		return json({ success: true });
	}

	error(400, 'Invalid action. Use "buy" or "sell".');
};

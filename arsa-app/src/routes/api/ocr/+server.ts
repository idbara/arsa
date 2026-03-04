import { json, error } from '@sveltejs/kit';
import { getR2 } from '$lib/server/r2';
import { env } from '$env/dynamic/private';
import { GetObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import type { RequestHandler } from './$types';

const MODEL_ID = '@cf/meta/llama-3.2-11b-vision-instruct';

const EXTRACTION_PROMPT = `You are a receipt data extraction assistant. Analyze this receipt image from an Indonesian store.

Extract and return ONLY a valid JSON object:
{
  "nominal": 0,
  "tanggal": "YYYY-MM-DD",
  "merchant": "Store name"
}

Rules:
- "nominal" is the total amount as a number (no currency symbol, no dots/commas). Example: 150000
- "tanggal" is the date in YYYY-MM-DD format. Look for "Tanggal", "Tgl", or date patterns.
- "merchant" is the store/restaurant name, usually at the top of the receipt.
- If a field cannot be determined, use null.
- Return ONLY the JSON object, no markdown, no explanation.`;

export const POST: RequestHandler = async ({ request, locals: { safeGetSession } }) => {
	const { user } = await safeGetSession();
	if (!user) {
		error(401, 'Unauthorized');
	}

	if (!env.CLOUDFLARE_AI_TOKEN || !env.R2_ACCOUNT_ID) {
		error(500, 'OCR not configured');
	}

	const { key } = await request.json();

	if (!key || !key.startsWith('receipts/')) {
		error(400, 'Invalid receipt key');
	}

	const presignedUrl = await getSignedUrl(
		getR2(),
		new GetObjectCommand({
			Bucket: env.R2_BUCKET_NAME!,
			Key: key
		}),
		{ expiresIn: 60 }
	);

	const imageResponse = await fetch(presignedUrl);
	if (!imageResponse.ok) {
		error(502, 'Failed to fetch receipt image from storage');
	}

	const arrayBuffer = await imageResponse.arrayBuffer();
	const base64 = Buffer.from(arrayBuffer).toString('base64');
	const contentType = imageResponse.headers.get('content-type') || 'image/jpeg';
	const dataUri = `data:${contentType};base64,${base64}`;

	const aiUrl = `https://api.cloudflare.com/client/v4/accounts/${env.R2_ACCOUNT_ID}/ai/run/${MODEL_ID}`;

	const aiResponse = await fetch(aiUrl, {
		method: 'POST',
		headers: {
			Authorization: `Bearer ${env.CLOUDFLARE_AI_TOKEN}`,
			'Content-Type': 'application/json'
		},
		body: JSON.stringify({
			messages: [
				{
					role: 'user',
					content: [
						{ type: 'text', text: EXTRACTION_PROMPT },
						{ type: 'image_url', image_url: { url: dataUri } }
					]
				}
			],
			max_tokens: 1024,
			temperature: 0.1
		})
	});

	if (!aiResponse.ok) {
		const errText = await aiResponse.text();
		console.error('Cloudflare AI error:', errText);
		return json({ success: false, error: 'OCR service unavailable' });
	}

	const aiResult = await aiResponse.json();

	if (!aiResult.success) {
		return json({ success: false, error: 'OCR processing failed' });
	}

	const raw = aiResult.result?.response;

	if (!raw) {
		return json({ success: false, error: 'Empty OCR response' });
	}

	let parsed: Record<string, unknown>;

	if (typeof raw === 'object') {
		parsed = raw;
	} else {
		try {
			const jsonMatch = String(raw).match(/\{[\s\S]*\}/);
			if (!jsonMatch) {
				return json({ success: false, error: 'No JSON found in OCR response' });
			}
			try {
				parsed = JSON.parse(jsonMatch[0]);
			} catch {
				const fixed = jsonMatch[0].replace(/(\w+)\s*:/g, '"$1":').replace(/'/g, '"');
				parsed = JSON.parse(fixed);
			}
		} catch {
			return json({ success: false, error: 'Could not parse receipt data' });
		}
	}

	return json({
		success: true,
		data: {
			nominal: typeof parsed.nominal === 'number' ? parsed.nominal : null,
			tanggal: typeof parsed.tanggal === 'string' ? parsed.tanggal : null,
			merchant: typeof parsed.merchant === 'string' ? parsed.merchant : null
		}
	});
};

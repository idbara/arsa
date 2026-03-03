import { redirect, error } from '@sveltejs/kit';
import { r2 } from '$lib/server/r2';
import { R2_BUCKET_NAME } from '$env/static/private';
import { GetObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import type { RequestHandler } from './$types';

export const GET: RequestHandler = async ({ params, locals: { safeGetSession } }) => {
	const { user } = await safeGetSession();
	if (!user) {
		error(401, 'Unauthorized');
	}

	const key = params.key;
	if (!key || !key.startsWith('receipts/')) {
		error(400, 'Invalid key');
	}

	const getUrl = await getSignedUrl(
		r2,
		new GetObjectCommand({
			Bucket: R2_BUCKET_NAME,
			Key: key
		}),
		{ expiresIn: 3600 }
	);

	redirect(302, getUrl);
};

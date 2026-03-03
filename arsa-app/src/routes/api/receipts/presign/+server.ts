import { json, error } from '@sveltejs/kit';
import { r2 } from '$lib/server/r2';
import { R2_BUCKET_NAME } from '$env/static/private';
import { PutObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import type { RequestHandler } from './$types';

export const POST: RequestHandler = async ({ request, locals: { safeGetSession, supabase } }) => {
	const { user } = await safeGetSession();
	if (!user) {
		error(401, 'Unauthorized');
	}

	const { data: profile } = await supabase
		.from('users')
		.select('family_id')
		.eq('id', user.id)
		.single();

	if (!profile?.family_id) {
		error(400, 'No family found');
	}

	const { contentType } = await request.json();

	if (!contentType || !contentType.startsWith('image/')) {
		error(400, 'Invalid content type');
	}

	const key = `receipts/${profile.family_id}/${crypto.randomUUID()}.jpg`;

	const putUrl = await getSignedUrl(
		r2,
		new PutObjectCommand({
			Bucket: R2_BUCKET_NAME,
			Key: key,
			ContentType: contentType
		}),
		{ expiresIn: 300 }
	);

	return json({ putUrl, key });
};

import { S3Client, PutBucketCorsCommand } from '@aws-sdk/client-s3';
import { config } from 'dotenv';

config();

const { R2_ACCOUNT_ID, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY, R2_BUCKET_NAME } = process.env;

if (!R2_ACCOUNT_ID || !R2_ACCESS_KEY_ID || !R2_SECRET_ACCESS_KEY || !R2_BUCKET_NAME) {
	console.error('Missing R2 env vars. Check .env file.');
	process.exit(1);
}

const r2 = new S3Client({
	region: 'auto',
	endpoint: `https://${R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
	credentials: {
		accessKeyId: R2_ACCESS_KEY_ID,
		secretAccessKey: R2_SECRET_ACCESS_KEY
	}
});

await r2.send(
	new PutBucketCorsCommand({
		Bucket: R2_BUCKET_NAME,
		CORSConfiguration: {
			CORSRules: [
				{
					AllowedOrigins: ['*'],
					AllowedMethods: ['PUT', 'GET'],
					AllowedHeaders: ['*'],
					MaxAgeSeconds: 3600
				}
			]
		}
	})
);

console.log(`CORS configured on bucket "${R2_BUCKET_NAME}".`);

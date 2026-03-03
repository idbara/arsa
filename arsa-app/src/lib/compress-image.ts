const MAX_DIMENSION = 1024;
const JPEG_QUALITY = 0.7;

export async function compressImage(file: File): Promise<Blob> {
	return new Promise((resolve, reject) => {
		const img = new Image();
		const url = URL.createObjectURL(file);

		img.onload = () => {
			URL.revokeObjectURL(url);

			let { width, height } = img;

			if (width > MAX_DIMENSION || height > MAX_DIMENSION) {
				if (width > height) {
					height = Math.round((height * MAX_DIMENSION) / width);
					width = MAX_DIMENSION;
				} else {
					width = Math.round((width * MAX_DIMENSION) / height);
					height = MAX_DIMENSION;
				}
			}

			const canvas = document.createElement('canvas');
			canvas.width = width;
			canvas.height = height;

			const ctx = canvas.getContext('2d');
			if (!ctx) {
				reject(new Error('Failed to get canvas context'));
				return;
			}

			ctx.drawImage(img, 0, 0, width, height);

			canvas.toBlob(
				(blob) => {
					if (blob) {
						resolve(blob);
					} else {
						reject(new Error('Failed to compress image'));
					}
				},
				'image/jpeg',
				JPEG_QUALITY
			);
		};

		img.onerror = () => {
			URL.revokeObjectURL(url);
			reject(new Error('Failed to load image'));
		};

		img.src = url;
	});
}

import sharp from 'sharp';
import { writeFileSync } from 'fs';

const svgIcon = `
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512">
  <rect width="512" height="512" rx="96" fill="#1a1a2e"/>
  <text x="256" y="340" font-family="system-ui, -apple-system, sans-serif"
        font-size="320" font-weight="700" text-anchor="middle" fill="#7c3aed">A</text>
  <rect x="128" y="380" width="256" height="8" rx="4" fill="#a78bfa"/>
</svg>`;

async function generate() {
  const svgBuffer = Buffer.from(svgIcon);

  await sharp(svgBuffer)
    .resize(192, 192)
    .png()
    .toFile('arsa-app/static/icons/icon-192.png');

  await sharp(svgBuffer)
    .resize(512, 512)
    .png()
    .toFile('arsa-app/static/icons/icon-512.png');

  console.log('Icons generated: icon-192.png, icon-512.png');
}

generate().catch(console.error);

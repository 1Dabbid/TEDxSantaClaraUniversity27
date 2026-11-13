/**
 * Rasterises src/app/icon.svg (the white "§" on black, outlined Inter Display
 * SemiBold) into the other icon files. Run after changing icon.svg:
 *
 *   node scripts/generate-icons.mjs
 *
 * Writes src/app/favicon.ico (16, 32, 48), src/app/apple-icon.png (180) and
 * public/icons/icon-192.png, icon-512.png (used by src/app/manifest.ts).
 * Uses sharp, which is installed with Next.js (not a direct dependency).
 * The outputs are committed; nothing runs at build time.
 */
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const svg = await readFile(join(root, 'src/app/icon.svg'));
const png = (size) => sharp(svg, { density: Math.ceil((72 * size) / 512) * 2 }).resize(size, size).png().toBuffer();

/** An .ico holding PNG images (supported by every current browser). */
function ico(images) {
  const header = Buffer.alloc(6 + 16 * images.length);
  header.writeUInt16LE(0, 0); // reserved
  header.writeUInt16LE(1, 2); // type: icon
  header.writeUInt16LE(images.length, 4);
  let offset = header.length;
  images.forEach(({ size, data }, i) => {
    const e = 6 + 16 * i;
    header.writeUInt8(size >= 256 ? 0 : size, e); // width
    header.writeUInt8(size >= 256 ? 0 : size, e + 1); // height
    header.writeUInt8(0, e + 2); // palette
    header.writeUInt8(0, e + 3); // reserved
    header.writeUInt16LE(1, e + 4); // colour planes
    header.writeUInt16LE(32, e + 6); // bits per pixel
    header.writeUInt32LE(data.length, e + 8);
    header.writeUInt32LE(offset, e + 12);
    offset += data.length;
  });
  return Buffer.concat([header, ...images.map((i) => i.data)]);
}

const favicon = await Promise.all([16, 32, 48].map(async (size) => ({ size, data: await png(size) })));
await writeFile(join(root, 'src/app/favicon.ico'), ico(favicon));
await writeFile(join(root, 'src/app/apple-icon.png'), await png(180));
await mkdir(join(root, 'public/icons'), { recursive: true });
for (const size of [192, 512]) await writeFile(join(root, `public/icons/icon-${size}.png`), await png(size));
console.log('icons written');

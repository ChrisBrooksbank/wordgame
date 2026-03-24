/**
 * Icon generator: converts SVG icons to PNG at all required PWA sizes.
 *
 * Usage:
 *   vite-node scripts/generateIcons.ts
 *
 * Outputs PNG files to static/icons/:
 *   icon-{size}.png         — standard icons
 *   icon-maskable-{size}.png — maskable icons (with safe-zone padding)
 *
 * Required sizes: 48, 72, 96, 128, 144, 192, 512
 */

import { createRequire } from 'module';
import { fileURLToPath } from 'url';
import path from 'path';
import fs from 'fs';

const require = createRequire(import.meta.url);
const sharp = require('sharp');

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.resolve(__dirname, '..');
const iconsDir = path.join(projectRoot, 'static', 'icons');

const SIZES = [48, 72, 96, 128, 144, 192, 512] as const;

const SOURCES = [
	{ svgFile: 'icon.svg', prefix: 'icon' },
	{ svgFile: 'icon-maskable.svg', prefix: 'icon-maskable' }
] as const;

async function generateIcons(): Promise<void> {
	fs.mkdirSync(iconsDir, { recursive: true });

	for (const { svgFile, prefix } of SOURCES) {
		const svgPath = path.join(iconsDir, svgFile);
		if (!fs.existsSync(svgPath)) {
			console.error(`Missing source SVG: ${svgPath}`);
			process.exit(1);
		}

		for (const size of SIZES) {
			const outPath = path.join(iconsDir, `${prefix}-${size}.png`);
			await sharp(svgPath).resize(size, size).png().toFile(outPath);
			console.log(`Generated ${path.basename(outPath)}`);
		}
	}

	console.log('All icons generated successfully.');
}

generateIcons().catch((err) => {
	console.error(err);
	process.exit(1);
});

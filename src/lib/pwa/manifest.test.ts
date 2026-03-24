import { describe, it, expect } from 'vitest';
import { readFileSync, existsSync } from 'fs';
import { fileURLToPath } from 'url';
import path from 'path';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.resolve(__dirname, '../../../');
const manifestPath = path.join(projectRoot, 'static', 'manifest.webmanifest');

const REQUIRED_SIZES = [48, 72, 96, 128, 144, 192, 512];

interface ManifestIcon {
	src: string;
	sizes: string;
	type: string;
	purpose: string;
}

interface Manifest {
	name: string;
	short_name: string;
	description: string;
	start_url: string;
	scope: string;
	display: string;
	orientation: string;
	background_color: string;
	theme_color: string;
	icons: ManifestIcon[];
}

describe('Web App Manifest', () => {
	let manifest: Manifest;

	it('manifest.webmanifest exists and is valid JSON', () => {
		expect(existsSync(manifestPath)).toBe(true);
		const raw = readFileSync(manifestPath, 'utf8');
		expect(() => {
			manifest = JSON.parse(raw) as Manifest;
		}).not.toThrow();
	});

	it('has required identity fields', () => {
		const raw = readFileSync(manifestPath, 'utf8');
		manifest = JSON.parse(raw) as Manifest;
		expect(manifest.name).toBe('Lexicon Forge');
		expect(manifest.short_name).toBe('LexForge');
		expect(typeof manifest.description).toBe('string');
		expect(manifest.description.length).toBeGreaterThan(0);
	});

	it('has correct display and start_url', () => {
		const raw = readFileSync(manifestPath, 'utf8');
		manifest = JSON.parse(raw) as Manifest;
		expect(manifest.display).toBe('standalone');
		expect(manifest.start_url).toBe('/');
		expect(manifest.scope).toBe('/');
	});

	it('has forge amber theme color and dark background', () => {
		const raw = readFileSync(manifestPath, 'utf8');
		manifest = JSON.parse(raw) as Manifest;
		expect(manifest.theme_color).toBe('#f97316');
		expect(manifest.background_color).toBe('#030712');
	});

	it('has portrait as primary orientation', () => {
		const raw = readFileSync(manifestPath, 'utf8');
		manifest = JSON.parse(raw) as Manifest;
		expect(manifest.orientation).toBe('portrait');
	});

	it('includes icons array with entries', () => {
		const raw = readFileSync(manifestPath, 'utf8');
		manifest = JSON.parse(raw) as Manifest;
		expect(Array.isArray(manifest.icons)).toBe(true);
		expect(manifest.icons.length).toBeGreaterThan(0);
	});

	it('has icons at all required sizes', () => {
		const raw = readFileSync(manifestPath, 'utf8');
		manifest = JSON.parse(raw) as Manifest;
		const pngIcons = manifest.icons.filter((icon) => icon.type === 'image/png');
		for (const size of REQUIRED_SIZES) {
			const sizeStr = `${size}x${size}`;
			const found = pngIcons.some((icon) => icon.sizes === sizeStr);
			expect(found, `Missing PNG icon at size ${sizeStr}`).toBe(true);
		}
	});

	it('has maskable icon variant at all required sizes', () => {
		const raw = readFileSync(manifestPath, 'utf8');
		manifest = JSON.parse(raw) as Manifest;
		const maskableIcons = manifest.icons.filter(
			(icon) => icon.purpose === 'maskable' && icon.type === 'image/png'
		);
		for (const size of REQUIRED_SIZES) {
			const sizeStr = `${size}x${size}`;
			const found = maskableIcons.some((icon) => icon.sizes === sizeStr);
			expect(found, `Missing maskable PNG icon at size ${sizeStr}`).toBe(true);
		}
	});

	it('has SVG icon entry', () => {
		const raw = readFileSync(manifestPath, 'utf8');
		manifest = JSON.parse(raw) as Manifest;
		const svgIcons = manifest.icons.filter((icon) => icon.type === 'image/svg+xml');
		expect(svgIcons.length).toBeGreaterThan(0);
		const hasMaskableSvg = svgIcons.some((icon) => icon.purpose === 'maskable');
		expect(hasMaskableSvg).toBe(true);
	});

	it('all referenced icon files exist on disk', () => {
		const raw = readFileSync(manifestPath, 'utf8');
		manifest = JSON.parse(raw) as Manifest;
		for (const icon of manifest.icons) {
			// icon.src is like "/icons/icon-48.png" → map to static/icons/icon-48.png
			const relativePath = icon.src.replace(/^\//, '');
			const fullPath = path.join(projectRoot, 'static', relativePath);
			expect(existsSync(fullPath), `Icon file missing: ${icon.src}`).toBe(true);
		}
	});
});

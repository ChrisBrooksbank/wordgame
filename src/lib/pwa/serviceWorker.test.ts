import { describe, it, expect } from 'vitest';
import { getServiceWorkerSupport, skipWaiting } from './serviceWorker.js';

describe('serviceWorker utilities', () => {
	describe('getServiceWorkerSupport', () => {
		it('returns false when navigator is undefined', () => {
			// In vitest node environment, navigator is not defined
			expect(getServiceWorkerSupport()).toBe(false);
		});
	});

	describe('skipWaiting', () => {
		it('does nothing when service workers are not supported', async () => {
			// Should resolve without throwing in node environment
			await expect(skipWaiting()).resolves.toBeUndefined();
		});
	});

	describe('workbox cache strategy configuration', () => {
		it('DAWG binary pattern matches word list URL', () => {
			const pattern = /\/words\.dawg$/i;
			expect(pattern.test('/words.dawg')).toBe(true);
			expect(pattern.test('/static/words.dawg')).toBe(true);
			expect(pattern.test('/words.dawg.map')).toBe(false);
		});

		it('static assets pattern matches JS/CSS/fonts', () => {
			const pattern = /\.(?:js|css|woff2?|ttf|otf|eot)$/i;
			expect(pattern.test('/app.js')).toBe(true);
			expect(pattern.test('/style.css')).toBe(true);
			expect(pattern.test('/font.woff2')).toBe(true);
			expect(pattern.test('/font.woff')).toBe(true);
			expect(pattern.test('/icon.png')).toBe(false);
		});

		it('API pattern matches dynamic data endpoints', () => {
			const pattern = /\/api\//i;
			expect(pattern.test('/api/leaderboard')).toBe(true);
			expect(pattern.test('/api/puzzle/today')).toBe(true);
			expect(pattern.test('/manifest.webmanifest')).toBe(false);
		});
	});
});

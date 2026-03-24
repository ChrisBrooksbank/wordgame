import { describe, it, expect } from 'vitest';
import { getOnlineStatus } from './networkStatus.js';

describe('networkStatus', () => {
	describe('getOnlineStatus', () => {
		it('returns a boolean', () => {
			expect(typeof getOnlineStatus()).toBe('boolean');
		});

		it('returns true when navigator.onLine is not false (SSR/node default)', () => {
			// In node/vitest, navigator.onLine is undefined — treated as online (true)
			const result = getOnlineStatus();
			expect(result).toBe(true);
		});
	});
});

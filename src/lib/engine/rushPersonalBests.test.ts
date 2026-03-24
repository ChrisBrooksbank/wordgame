/**
 * Tests for Rush Mode personal best tracking.
 */
import { describe, it, expect } from 'vitest';
import {
	updatePersonalBests,
	anyBroken,
	longestWordFromList,
	DEFAULT_RUSH_PERSONAL_BESTS
} from './rushPersonalBests.js';
import type { RushPersonalBests } from './rushPersonalBests.js';

const defaults: RushPersonalBests = { ...DEFAULT_RUSH_PERSONAL_BESTS };

describe('updatePersonalBests', () => {
	it('breaks highScore when new score exceeds current', () => {
		const { updated, broken } = updatePersonalBests(defaults, 500, 1, 0, '');
		expect(broken.highScore).toBe(true);
		expect(updated.highScore).toBe(500);
	});

	it('does not break highScore when new score equals current', () => {
		const current: RushPersonalBests = { ...defaults, highScore: 500 };
		const { broken } = updatePersonalBests(current, 500, 1, 0, '');
		expect(broken.highScore).toBe(false);
	});

	it('does not break highScore when new score is lower', () => {
		const current: RushPersonalBests = { ...defaults, highScore: 1000 };
		const { updated, broken } = updatePersonalBests(current, 500, 1, 0, '');
		expect(broken.highScore).toBe(false);
		expect(updated.highScore).toBe(1000);
	});

	it('breaks bestComboStreak when new streak exceeds current', () => {
		const { updated, broken } = updatePersonalBests(defaults, 0, 3, 0, '');
		expect(broken.bestComboStreak).toBe(true);
		expect(updated.bestComboStreak).toBe(3);
	});

	it('does not break bestComboStreak when equal', () => {
		const current: RushPersonalBests = { ...defaults, bestComboStreak: 3 };
		const { broken } = updatePersonalBests(current, 0, 3, 0, '');
		expect(broken.bestComboStreak).toBe(false);
	});

	it('breaks mostWords when word count exceeds current', () => {
		const { updated, broken } = updatePersonalBests(defaults, 0, 1, 10, '');
		expect(broken.mostWords).toBe(true);
		expect(updated.mostWords).toBe(10);
	});

	it('does not break mostWords when equal', () => {
		const current: RushPersonalBests = { ...defaults, mostWords: 10 };
		const { broken } = updatePersonalBests(current, 0, 1, 10, '');
		expect(broken.mostWords).toBe(false);
	});

	it('breaks longestWord when new word is longer', () => {
		const { updated, broken } = updatePersonalBests(defaults, 0, 1, 0, 'FORGE');
		expect(broken.longestWord).toBe(true);
		expect(updated.longestWord).toBe('FORGE');
	});

	it('does not break longestWord when same length', () => {
		const current: RushPersonalBests = { ...defaults, longestWord: 'FLAME' };
		const { broken } = updatePersonalBests(current, 0, 1, 0, 'FORGE');
		expect(broken.longestWord).toBe(false);
	});

	it('does not break longestWord when shorter', () => {
		const current: RushPersonalBests = { ...defaults, longestWord: 'SPARKLE' };
		const { updated, broken } = updatePersonalBests(current, 0, 1, 0, 'CAT');
		expect(broken.longestWord).toBe(false);
		expect(updated.longestWord).toBe('SPARKLE');
	});

	it('can break multiple bests at once', () => {
		const { broken } = updatePersonalBests(defaults, 999, 5, 20, 'EXTRAORDINARY');
		expect(broken.highScore).toBe(true);
		expect(broken.bestComboStreak).toBe(true);
		expect(broken.mostWords).toBe(true);
		expect(broken.longestWord).toBe(true);
	});

	it('breaks no bests on a blank game against defaults', () => {
		const { broken } = updatePersonalBests(defaults, 0, 1, 0, '');
		expect(broken.highScore).toBe(false);
		expect(broken.bestComboStreak).toBe(false);
		expect(broken.mostWords).toBe(false);
		expect(broken.longestWord).toBe(false);
	});
});

describe('anyBroken', () => {
	it('returns false when nothing broken', () => {
		expect(
			anyBroken({ highScore: false, bestComboStreak: false, mostWords: false, longestWord: false })
		).toBe(false);
	});

	it('returns true when highScore broken', () => {
		expect(
			anyBroken({ highScore: true, bestComboStreak: false, mostWords: false, longestWord: false })
		).toBe(true);
	});

	it('returns true when longestWord broken', () => {
		expect(
			anyBroken({ highScore: false, bestComboStreak: false, mostWords: false, longestWord: true })
		).toBe(true);
	});
});

describe('longestWordFromList', () => {
	it('returns empty string for empty list', () => {
		expect(longestWordFromList([])).toBe('');
	});

	it('returns the single word in a one-element list', () => {
		expect(longestWordFromList(['WORD'])).toBe('WORD');
	});

	it('returns the longest word', () => {
		expect(longestWordFromList(['CAT', 'FORGE', 'IT'])).toBe('FORGE');
	});

	it('returns the first longest word when tied', () => {
		expect(longestWordFromList(['CATS', 'DOGS'])).toBe('CATS');
	});
});

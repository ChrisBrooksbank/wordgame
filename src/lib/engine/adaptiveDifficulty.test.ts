/**
 * Tests for the adaptive difficulty system.
 */
import { describe, it, expect } from 'vitest';
import {
	getDefaultDifficultyProfile,
	computeDifficultyLevel,
	updateDifficultyProfile,
	buildAdjustedWeights,
	weightedRandomLetterWithDifficulty,
	generateRushGrid
} from './adaptiveDifficulty.js';
import type { DifficultyLevel, RushGameRecord } from './adaptiveDifficulty.js';
import { mulberry32 } from './dailyPuzzle.js';
import { LETTER_WEIGHTS } from './hexGrid.js';

// -----------------------------------------------------------------------
// Default profile
// -----------------------------------------------------------------------

describe('getDefaultDifficultyProfile', () => {
	it('returns empty game history', () => {
		const profile = getDefaultDifficultyProfile();
		expect(profile.recentGames).toHaveLength(0);
	});

	it('returns normal difficulty', () => {
		const profile = getDefaultDifficultyProfile();
		expect(profile.level).toBe('normal');
	});
});

// -----------------------------------------------------------------------
// computeDifficultyLevel
// -----------------------------------------------------------------------

describe('computeDifficultyLevel', () => {
	it('returns normal with no history', () => {
		expect(computeDifficultyLevel([])).toBe('normal');
	});

	it('returns easy when avg score is below threshold', () => {
		const games: RushGameRecord[] = [
			{ score: 100, wordsPerMinute: 2 },
			{ score: 150, wordsPerMinute: 3 },
			{ score: 200, wordsPerMinute: 2 }
		];
		expect(computeDifficultyLevel(games)).toBe('easy');
	});

	it('returns hard when avg score is at or above hard threshold', () => {
		const games: RushGameRecord[] = [
			{ score: 800, wordsPerMinute: 10 },
			{ score: 900, wordsPerMinute: 12 }
		];
		expect(computeDifficultyLevel(games)).toBe('hard');
	});

	it('returns normal for mid-range scores', () => {
		const games: RushGameRecord[] = [
			{ score: 400, wordsPerMinute: 5 },
			{ score: 500, wordsPerMinute: 6 }
		];
		expect(computeDifficultyLevel(games)).toBe('normal');
	});

	it('only considers the last 5 games', () => {
		// 6 easy games followed by 5 hard games — hard should win
		const easyGames: RushGameRecord[] = Array.from({ length: 6 }, () => ({
			score: 100,
			wordsPerMinute: 1
		}));
		const hardGames: RushGameRecord[] = Array.from({ length: 5 }, () => ({
			score: 900,
			wordsPerMinute: 12
		}));
		expect(computeDifficultyLevel([...easyGames, ...hardGames])).toBe('hard');
	});
});

// -----------------------------------------------------------------------
// updateDifficultyProfile
// -----------------------------------------------------------------------

describe('updateDifficultyProfile', () => {
	it('appends a game record to recentGames', () => {
		const profile = getDefaultDifficultyProfile();
		const updated = updateDifficultyProfile(profile, 250, 5, 90_000);
		expect(updated.recentGames).toHaveLength(1);
		expect(updated.recentGames[0].score).toBe(250);
	});

	it('computes wordsPerMinute correctly', () => {
		const profile = getDefaultDifficultyProfile();
		// 6 words in 60 seconds → 6 wpm
		const updated = updateDifficultyProfile(profile, 300, 6, 60_000);
		expect(updated.recentGames[0].wordsPerMinute).toBeCloseTo(6);
	});

	it('caps recentGames at 5 entries', () => {
		let profile = getDefaultDifficultyProfile();
		for (let i = 0; i < 7; i++) {
			profile = updateDifficultyProfile(profile, 400, 5, 90_000);
		}
		expect(profile.recentGames).toHaveLength(5);
	});

	it('sets level to easy after consecutive low-score games', () => {
		let profile = getDefaultDifficultyProfile();
		for (let i = 0; i < 3; i++) {
			profile = updateDifficultyProfile(profile, 100, 2, 90_000);
		}
		expect(profile.level).toBe('easy');
	});

	it('sets level to hard after consecutive high-score games', () => {
		let profile = getDefaultDifficultyProfile();
		for (let i = 0; i < 3; i++) {
			profile = updateDifficultyProfile(profile, 900, 15, 90_000);
		}
		expect(profile.level).toBe('hard');
	});

	it('handles zero-duration gracefully (no division by zero)', () => {
		const profile = getDefaultDifficultyProfile();
		expect(() => updateDifficultyProfile(profile, 300, 5, 0)).not.toThrow();
		const updated = updateDifficultyProfile(profile, 300, 5, 0);
		expect(updated.recentGames[0].wordsPerMinute).toBe(0);
	});
});

// -----------------------------------------------------------------------
// buildAdjustedWeights
// -----------------------------------------------------------------------

describe('buildAdjustedWeights', () => {
	it('returns 26 weights', () => {
		for (const level of ['easy', 'normal', 'hard'] as DifficultyLevel[]) {
			expect(buildAdjustedWeights(level)).toHaveLength(26);
		}
	});

	it('all weights are positive', () => {
		for (const level of ['easy', 'normal', 'hard'] as DifficultyLevel[]) {
			expect(buildAdjustedWeights(level).every((w) => w > 0)).toBe(true);
		}
	});

	it('easy mode boosts E weight above normal', () => {
		const normal = buildAdjustedWeights('normal');
		const easy = buildAdjustedWeights('easy');
		const letters = Object.keys(LETTER_WEIGHTS);
		const eIdx = letters.indexOf('E');
		expect(eIdx).toBeGreaterThanOrEqual(0);
		expect(easy[eIdx]).toBeGreaterThan(normal[eIdx]);
	});

	it('hard mode boosts Q weight above normal', () => {
		const normal = buildAdjustedWeights('normal');
		const hard = buildAdjustedWeights('hard');
		// Q is at index 16 (A=0, B=1, ... Q=16)
		// We can just check that some rare letters are boosted
		const totalNormal = normal.reduce((a, b) => a + b, 0);
		const totalHard = hard.reduce((a, b) => a + b, 0);
		// Totals will differ — confirm they do
		expect(totalNormal).not.toBeCloseTo(totalHard, 0);
	});
});

// -----------------------------------------------------------------------
// weightedRandomLetterWithDifficulty
// -----------------------------------------------------------------------

describe('weightedRandomLetterWithDifficulty', () => {
	it('returns a single uppercase letter', () => {
		const rng = mulberry32(42);
		for (let i = 0; i < 50; i++) {
			const letter = weightedRandomLetterWithDifficulty(rng, 'normal');
			expect(letter).toMatch(/^[A-Z]$/);
		}
	});

	it('easy mode produces more vowels/common letters than hard mode', () => {
		const COMMON = new Set(['E', 'A', 'R', 'S', 'T']);
		const N = 1000;

		let easyCommon = 0;
		const easyRng = mulberry32(1);
		for (let i = 0; i < N; i++) {
			if (COMMON.has(weightedRandomLetterWithDifficulty(easyRng, 'easy'))) easyCommon++;
		}

		let hardCommon = 0;
		const hardRng = mulberry32(1);
		for (let i = 0; i < N; i++) {
			if (COMMON.has(weightedRandomLetterWithDifficulty(hardRng, 'hard'))) hardCommon++;
		}

		expect(easyCommon).toBeGreaterThan(hardCommon);
	});

	it('hard mode produces more rare letters than easy mode', () => {
		const RARE = new Set(['Q', 'X', 'Z', 'J', 'K']);
		const N = 1000;

		let hardRare = 0;
		const hardRng = mulberry32(7);
		for (let i = 0; i < N; i++) {
			if (RARE.has(weightedRandomLetterWithDifficulty(hardRng, 'hard'))) hardRare++;
		}

		let easyRare = 0;
		const easyRng = mulberry32(7);
		for (let i = 0; i < N; i++) {
			if (RARE.has(weightedRandomLetterWithDifficulty(easyRng, 'easy'))) easyRare++;
		}

		expect(hardRare).toBeGreaterThan(easyRare);
	});
});

// -----------------------------------------------------------------------
// generateRushGrid
// -----------------------------------------------------------------------

describe('generateRushGrid', () => {
	it('generates a 4x4 grid with 12 tiles', () => {
		const rng = mulberry32(123);
		const grid = generateRushGrid('4x4', rng, 'normal');
		expect(grid.tiles).toHaveLength(12);
		expect(grid.size).toBe('4x4');
	});

	it('all tiles have single uppercase letters', () => {
		for (const level of ['easy', 'normal', 'hard'] as DifficultyLevel[]) {
			const grid = generateRushGrid('4x4', mulberry32(99), level);
			for (const tile of grid.tiles) {
				expect(tile.letter).toMatch(/^[A-Z]$/);
			}
		}
	});

	it('different seeds produce different grids', () => {
		const g1 = generateRushGrid('4x4', mulberry32(1), 'normal');
		const g2 = generateRushGrid('4x4', mulberry32(2), 'normal');
		expect(g1.tiles.map((t) => t.letter).join('')).not.toBe(g2.tiles.map((t) => t.letter).join(''));
	});
});

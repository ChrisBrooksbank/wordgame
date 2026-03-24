/**
 * Adaptive difficulty system for Rush Mode.
 *
 * Tracks player performance across games and adjusts the letter distribution
 * for subsequent games:
 *  - Below average score → more common letters (E, A, R, S, T)
 *  - Above average score → more challenging letters (Q, X, Z, J, K)
 *
 * Difficulty is computed between games, never mid-game.
 */

import { LETTER_WEIGHTS, gridCoords, hexKey } from './hexGrid.js';
import type { HexGrid, HexTile, GridSize } from './hexGrid.js';

// -----------------------------------------------------------------------
// Types
// -----------------------------------------------------------------------

export type DifficultyLevel = 'easy' | 'normal' | 'hard';

export interface RushGameRecord {
	/** Raw score earned in the game. */
	score: number;
	/** Words found per minute (word_count / (duration_ms / 60_000)). */
	wordsPerMinute: number;
}

export interface DifficultyProfile {
	/** Sliding window of recent game records. */
	recentGames: RushGameRecord[];
	/** Current difficulty level derived from recent performance. */
	level: DifficultyLevel;
}

// -----------------------------------------------------------------------
// Constants
// -----------------------------------------------------------------------

/** Number of recent games considered when computing difficulty. */
const WINDOW_SIZE = 5;

/**
 * Average-score thresholds that determine difficulty transitions.
 * Tuned so a casual player stays in 'normal' and extreme outliers move
 * to 'easy' or 'hard'.
 */
const EASY_SCORE_THRESHOLD = 300;
const HARD_SCORE_THRESHOLD = 700;

/** Multiplicative boosts applied in easy mode to common letters. */
const EASY_BOOST: Record<string, number> = { E: 3, A: 3, R: 2, S: 2, T: 3 };

/** Multiplicative boosts applied in hard mode to rare letters. */
const HARD_BOOST: Record<string, number> = { Q: 4, X: 4, Z: 4, J: 4, K: 2 };

/** Multiplicative reductions applied in hard mode to common letters. */
const HARD_REDUCE: Record<string, number> = { E: 0.4, A: 0.4, T: 0.4, S: 0.5, R: 0.5 };

// Precompute the base letter array from LETTER_WEIGHTS
const LETTERS = Object.keys(LETTER_WEIGHTS);
const BASE_WEIGHTS = LETTERS.map((l) => LETTER_WEIGHTS[l]);

// -----------------------------------------------------------------------
// Profile helpers
// -----------------------------------------------------------------------

export function getDefaultDifficultyProfile(): DifficultyProfile {
	return { recentGames: [], level: 'normal' };
}

/**
 * Derive the difficulty level from the recent-games window.
 * Returns 'normal' if there is no history yet.
 */
export function computeDifficultyLevel(recentGames: RushGameRecord[]): DifficultyLevel {
	if (recentGames.length === 0) return 'normal';
	const window = recentGames.slice(-WINDOW_SIZE);
	const avgScore = window.reduce((sum, g) => sum + g.score, 0) / window.length;
	if (avgScore < EASY_SCORE_THRESHOLD) return 'easy';
	if (avgScore >= HARD_SCORE_THRESHOLD) return 'hard';
	return 'normal';
}

/**
 * Record a completed game and return an updated difficulty profile.
 *
 * @param profile    Existing profile (may be the default).
 * @param score      Total score earned this game.
 * @param wordCount  Number of words found.
 * @param durationMs Duration of the game in ms (use RUSH_DURATION_MS normally).
 */
export function updateDifficultyProfile(
	profile: DifficultyProfile,
	score: number,
	wordCount: number,
	durationMs: number
): DifficultyProfile {
	const wordsPerMinute = durationMs > 0 ? wordCount / (durationMs / 60_000) : 0;
	const record: RushGameRecord = { score, wordsPerMinute };
	const recentGames = [...profile.recentGames, record].slice(-WINDOW_SIZE);
	const level = computeDifficultyLevel(recentGames);
	return { recentGames, level };
}

// -----------------------------------------------------------------------
// Letter picking with difficulty bias
// -----------------------------------------------------------------------

/**
 * Builds an adjusted weight array for the given difficulty level.
 */
export function buildAdjustedWeights(level: DifficultyLevel): number[] {
	return LETTERS.map((l, i) => {
		let w = BASE_WEIGHTS[i];
		if (level === 'easy' && EASY_BOOST[l] !== undefined) {
			w *= EASY_BOOST[l];
		}
		if (level === 'hard') {
			if (HARD_BOOST[l] !== undefined) w *= HARD_BOOST[l];
			if (HARD_REDUCE[l] !== undefined) w *= HARD_REDUCE[l];
		}
		return w;
	});
}

/**
 * Picks a weighted-random letter adjusted for the given difficulty level.
 */
export function weightedRandomLetterWithDifficulty(
	rng: () => number,
	level: DifficultyLevel
): string {
	if (level === 'normal') {
		// Fast path: use base weights unchanged
		const total = BASE_WEIGHTS.reduce((a, b) => a + b, 0);
		let target = rng() * total;
		for (let i = 0; i < LETTERS.length; i++) {
			target -= BASE_WEIGHTS[i];
			if (target <= 0) return LETTERS[i];
		}
		return LETTERS[LETTERS.length - 1];
	}

	const weights = buildAdjustedWeights(level);
	const total = weights.reduce((a, b) => a + b, 0);
	let target = rng() * total;
	for (let i = 0; i < LETTERS.length; i++) {
		target -= weights[i];
		if (target <= 0) return LETTERS[i];
	}
	return LETTERS[LETTERS.length - 1];
}

// -----------------------------------------------------------------------
// Grid generation
// -----------------------------------------------------------------------

/**
 * Generates a Rush-Mode HexGrid using difficulty-adjusted letter distribution.
 *
 * @param size       Grid size (always '4x4' for Rush Mode).
 * @param rng        Seeded or live RNG returning values in [0, 1).
 * @param level      Current difficulty level.
 */
export function generateRushGrid(
	size: GridSize,
	rng: () => number,
	level: DifficultyLevel
): HexGrid {
	const coords = gridCoords(size);
	const tiles: HexTile[] = coords.map((coord, i) => ({
		coord,
		letter: weightedRandomLetterWithDifficulty(rng, level),
		id: `tile-${i}-${hexKey(coord)}`
	}));
	return { tiles, size };
}

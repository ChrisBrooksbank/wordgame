/**
 * Daily puzzle generation using mulberry32 seeded PRNG.
 *
 * The daily puzzle is a 5x5 hex grid (19 tiles) generated deterministically
 * from a UTC date string. The center tile (0,0) is the Catalyst Letter which
 * must be included in every valid word.
 */

import { generateGrid, hexEqual, type HexGrid, type HexTile } from './hexGrid.js';

// ---------------------------------------------------------------------------
// Daily Forge constants
// ---------------------------------------------------------------------------

/** Maximum number of word submissions allowed in a Daily Forge game. */
export const DAILY_MOVE_BUDGET = 15;

// ---------------------------------------------------------------------------
// PRNG
// ---------------------------------------------------------------------------

/**
 * mulberry32 — fast, high-quality 32-bit seeded PRNG.
 * Returns a function that produces values in [0, 1) on each call.
 */
export function mulberry32(seed: number): () => number {
	let s = seed >>> 0; // ensure 32-bit unsigned
	return function () {
		s = (s + 0x6d2b79f5) >>> 0;
		let z = s;
		z = Math.imul(z ^ (z >>> 15), z | 1);
		z ^= z + Math.imul(z ^ (z >>> 7), z | 61);
		z = (z ^ (z >>> 14)) >>> 0;
		return z / 0x100000000;
	};
}

// ---------------------------------------------------------------------------
// Seed derivation
// ---------------------------------------------------------------------------

/**
 * Converts a UTC date string (YYYY-MM-DD) to a 32-bit integer seed.
 * The same date string always produces the same seed on all devices.
 */
export function dateToSeed(dateStr: string): number {
	// Simple djb2-style hash over the date string bytes
	let hash = 0;
	for (let i = 0; i < dateStr.length; i++) {
		hash = (Math.imul(hash, 31) + dateStr.charCodeAt(i)) >>> 0;
	}
	return hash;
}

/**
 * Returns today's UTC date as a "YYYY-MM-DD" string.
 * Using UTC ensures the same puzzle is served at the same instant worldwide.
 */
export function todayUTC(): string {
	const now = new Date();
	const y = now.getUTCFullYear();
	const m = String(now.getUTCMonth() + 1).padStart(2, '0');
	const d = String(now.getUTCDate()).padStart(2, '0');
	return `${y}-${m}-${d}`;
}

// ---------------------------------------------------------------------------
// Puzzle day number
// ---------------------------------------------------------------------------

/** Epoch date for puzzle numbering: Day 1 = 2026-01-01 (UTC). */
const PUZZLE_EPOCH_MS = Date.UTC(2026, 0, 1);

/**
 * Returns the 1-based sequential puzzle number for a given UTC date string.
 * Day 1 = 2026-01-01. Dates before the epoch return ≤ 0.
 */
export function puzzleDayNumber(dateStr: string = todayUTC()): number {
	const [y, m, d] = dateStr.split('-').map(Number);
	const dateMs = Date.UTC(y, m - 1, d);
	return Math.floor((dateMs - PUZZLE_EPOCH_MS) / 86_400_000) + 1;
}

// ---------------------------------------------------------------------------
// Daily puzzle
// ---------------------------------------------------------------------------

export interface DailyPuzzle {
	/** The UTC date string this puzzle belongs to (YYYY-MM-DD). */
	date: string;
	/** The 5x5 hex grid of tiles. */
	grid: HexGrid;
	/** The center tile at coordinate (0,0) — the Catalyst Letter. */
	catalystTile: HexTile;
	/** The numeric seed used to generate this puzzle. */
	seed: number;
}

/**
 * Generates a deterministic daily puzzle for the given UTC date string.
 * Passing the same date on any device worldwide produces an identical puzzle.
 *
 * @param dateStr  UTC date in "YYYY-MM-DD" format (default: today's UTC date)
 */
export function generateDailyPuzzle(dateStr: string = todayUTC()): DailyPuzzle {
	const seed = dateToSeed(dateStr);
	const rng = mulberry32(seed);
	const grid = generateGrid('5x5', rng);

	const center = { q: 0, r: 0 };
	const catalystTile = grid.tiles.find((t) => hexEqual(t.coord, center));
	if (!catalystTile) {
		throw new Error('Daily puzzle grid is missing the center tile at (0,0)');
	}

	return { date: dateStr, grid, catalystTile, seed };
}

// ---------------------------------------------------------------------------
// Star rating
// ---------------------------------------------------------------------------

/**
 * Minimum score thresholds to reach each star level (2–5).
 * Scores below the `two` threshold receive 1 star (completing the puzzle
 * always awards at least 1 star).
 */
export interface StarThresholds {
	two: number;
	three: number;
	four: number;
	five: number;
}

/** English letter frequencies (percent, A–Z) — used for threshold estimation. */
const LETTER_FREQ: Record<string, number> = {
	A: 8.17,
	B: 1.49,
	C: 2.78,
	D: 4.25,
	E: 12.7,
	F: 2.23,
	G: 2.02,
	H: 6.09,
	I: 6.97,
	J: 0.15,
	K: 0.77,
	L: 4.03,
	M: 2.41,
	N: 6.75,
	O: 7.51,
	P: 1.93,
	Q: 0.1,
	R: 5.99,
	S: 6.33,
	T: 9.06,
	U: 2.76,
	V: 0.98,
	W: 2.36,
	X: 0.15,
	Y: 1.97,
	Z: 0.07
};

/**
 * Maps an average letter frequency (percent) to an estimated rarity multiplier.
 * Mirrors the rarity thresholds used in scoring.ts.
 */
function freqToMultiplier(avgFreq: number): 1 | 2 | 3 | 4 | 5 {
	if (avgFreq >= 5.0) return 1;
	if (avgFreq >= 3.5) return 2;
	if (avgFreq >= 2.5) return 3;
	if (avgFreq >= 1.5) return 4;
	return 5;
}

/**
 * Calculates per-puzzle star thresholds based on the puzzle's tile letter distribution.
 *
 * Theoretical max = DAILY_MOVE_BUDGET × (average 5-letter word base = 25) × estimated multiplier.
 * Thresholds are set at 20 / 40 / 60 / 80 % of that theoretical max.
 */
export function calculateStarThresholds(puzzle: DailyPuzzle): StarThresholds {
	const letters = puzzle.grid.tiles.map((t) => t.letter);
	const avgFreq = letters.reduce((sum, l) => sum + (LETTER_FREQ[l] ?? 0), 0) / letters.length;
	const multiplier = freqToMultiplier(avgFreq);
	const theoreticalMax = DAILY_MOVE_BUDGET * 25 * multiplier;

	return {
		two: Math.round(theoreticalMax * 0.2),
		three: Math.round(theoreticalMax * 0.4),
		four: Math.round(theoreticalMax * 0.6),
		five: Math.round(theoreticalMax * 0.8)
	};
}

/**
 * Returns the 1–5 star rating for a final score against the puzzle's thresholds.
 * Always returns at least 1 (completing the puzzle awards a minimum of 1 star).
 */
export function getStarRating(score: number, thresholds: StarThresholds): 1 | 2 | 3 | 4 | 5 {
	if (score >= thresholds.five) return 5;
	if (score >= thresholds.four) return 4;
	if (score >= thresholds.three) return 3;
	if (score >= thresholds.two) return 2;
	return 1;
}

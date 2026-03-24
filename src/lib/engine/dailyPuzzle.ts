/**
 * Daily puzzle generation using mulberry32 seeded PRNG.
 *
 * The daily puzzle is a 5x5 hex grid (19 tiles) generated deterministically
 * from a UTC date string. The center tile (0,0) is the Catalyst Letter which
 * must be included in every valid word.
 */

import { generateGrid, hexEqual, type HexGrid, type HexTile } from './hexGrid.js';

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

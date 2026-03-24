import { describe, it, expect } from 'vitest';
import { mulberry32, dateToSeed, generateDailyPuzzle, todayUTC } from './dailyPuzzle.js';

describe('mulberry32', () => {
	it('returns values in [0, 1)', () => {
		const rng = mulberry32(12345);
		for (let i = 0; i < 100; i++) {
			const v = rng();
			expect(v).toBeGreaterThanOrEqual(0);
			expect(v).toBeLessThan(1);
		}
	});

	it('is deterministic: same seed → same sequence', () => {
		const rng1 = mulberry32(99999);
		const rng2 = mulberry32(99999);
		for (let i = 0; i < 20; i++) {
			expect(rng1()).toBe(rng2());
		}
	});

	it('different seeds produce different sequences', () => {
		const rng1 = mulberry32(1);
		const rng2 = mulberry32(2);
		const seq1 = Array.from({ length: 10 }, () => rng1());
		const seq2 = Array.from({ length: 10 }, () => rng2());
		expect(seq1).not.toEqual(seq2);
	});

	it('produces reasonably uniform distribution', () => {
		const rng = mulberry32(42);
		const buckets = [0, 0, 0, 0, 0];
		for (let i = 0; i < 5000; i++) {
			const idx = Math.floor(rng() * 5);
			buckets[idx]++;
		}
		// Each bucket should be roughly 1000 ± 200
		for (const count of buckets) {
			expect(count).toBeGreaterThan(800);
			expect(count).toBeLessThan(1200);
		}
	});
});

describe('dateToSeed', () => {
	it('returns a number', () => {
		expect(typeof dateToSeed('2026-03-24')).toBe('number');
	});

	it('is deterministic for the same date', () => {
		expect(dateToSeed('2026-03-24')).toBe(dateToSeed('2026-03-24'));
	});

	it('produces different seeds for different dates', () => {
		expect(dateToSeed('2026-03-24')).not.toBe(dateToSeed('2026-03-25'));
		expect(dateToSeed('2026-01-01')).not.toBe(dateToSeed('2027-01-01'));
	});

	it('returns a 32-bit unsigned integer', () => {
		const seed = dateToSeed('2026-03-24');
		expect(seed).toBeGreaterThanOrEqual(0);
		expect(seed).toBeLessThanOrEqual(0xffffffff);
	});
});

describe('todayUTC', () => {
	it('returns a string in YYYY-MM-DD format', () => {
		const today = todayUTC();
		expect(today).toMatch(/^\d{4}-\d{2}-\d{2}$/);
	});
});

describe('generateDailyPuzzle', () => {
	it('generates a 5x5 grid (19 tiles)', () => {
		const puzzle = generateDailyPuzzle('2026-03-24');
		expect(puzzle.grid.size).toBe('5x5');
		expect(puzzle.grid.tiles).toHaveLength(19);
	});

	it('is deterministic: same date → same puzzle', () => {
		const p1 = generateDailyPuzzle('2026-03-24');
		const p2 = generateDailyPuzzle('2026-03-24');
		const letters1 = p1.grid.tiles.map((t) => t.letter).join('');
		const letters2 = p2.grid.tiles.map((t) => t.letter).join('');
		expect(letters1).toBe(letters2);
	});

	it('different dates produce different puzzles', () => {
		const p1 = generateDailyPuzzle('2026-03-24');
		const p2 = generateDailyPuzzle('2026-03-25');
		const letters1 = p1.grid.tiles.map((t) => t.letter).join('');
		const letters2 = p2.grid.tiles.map((t) => t.letter).join('');
		expect(letters1).not.toBe(letters2);
	});

	it('catalystTile is the center tile at (0,0)', () => {
		const puzzle = generateDailyPuzzle('2026-03-24');
		expect(puzzle.catalystTile.coord).toEqual({ q: 0, r: 0 });
	});

	it('catalystTile is present in grid tiles', () => {
		const puzzle = generateDailyPuzzle('2026-03-24');
		const found = puzzle.grid.tiles.find((t) => t.coord.q === 0 && t.coord.r === 0);
		expect(found).toBeDefined();
		expect(found?.letter).toBe(puzzle.catalystTile.letter);
	});

	it('stores the date string on the puzzle', () => {
		const puzzle = generateDailyPuzzle('2026-06-15');
		expect(puzzle.date).toBe('2026-06-15');
	});

	it('stores the seed on the puzzle', () => {
		const puzzle = generateDailyPuzzle('2026-03-24');
		expect(puzzle.seed).toBe(dateToSeed('2026-03-24'));
	});

	it('all tiles have a single uppercase letter', () => {
		const puzzle = generateDailyPuzzle('2026-03-24');
		for (const tile of puzzle.grid.tiles) {
			expect(tile.letter).toMatch(/^[A-Z]$/);
		}
	});

	it('uses todayUTC as default date', () => {
		const today = todayUTC();
		const puzzle = generateDailyPuzzle();
		expect(puzzle.date).toBe(today);
	});
});

import { describe, it, expect } from 'vitest';
import {
	mulberry32,
	dateToSeed,
	generateDailyPuzzle,
	todayUTC,
	DAILY_MOVE_BUDGET,
	puzzleDayNumber,
	calculateStarThresholds,
	getStarRating,
	type StarThresholds
} from './dailyPuzzle.js';

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

describe('DAILY_MOVE_BUDGET', () => {
	it('is 15', () => {
		expect(DAILY_MOVE_BUDGET).toBe(15);
	});
});

describe('calculateStarThresholds', () => {
	it('returns thresholds in strictly ascending order', () => {
		const puzzle = generateDailyPuzzle('2026-03-24');
		const t = calculateStarThresholds(puzzle);
		expect(t.two).toBeLessThan(t.three);
		expect(t.three).toBeLessThan(t.four);
		expect(t.four).toBeLessThan(t.five);
	});

	it('all thresholds are positive', () => {
		const puzzle = generateDailyPuzzle('2026-03-24');
		const t = calculateStarThresholds(puzzle);
		expect(t.two).toBeGreaterThan(0);
		expect(t.three).toBeGreaterThan(0);
		expect(t.four).toBeGreaterThan(0);
		expect(t.five).toBeGreaterThan(0);
	});

	it('is deterministic for the same puzzle date', () => {
		const p1 = generateDailyPuzzle('2026-03-24');
		const p2 = generateDailyPuzzle('2026-03-24');
		expect(calculateStarThresholds(p1)).toEqual(calculateStarThresholds(p2));
	});

	it('does not throw for arbitrary puzzle dates', () => {
		for (const date of ['2026-01-01', '2026-06-15', '2027-12-31']) {
			expect(() => calculateStarThresholds(generateDailyPuzzle(date))).not.toThrow();
		}
	});

	it('five-star threshold is within a reasonable score range', () => {
		const puzzle = generateDailyPuzzle('2026-03-24');
		const t = calculateStarThresholds(puzzle);
		// With DAILY_MOVE_BUDGET=15 and avg 5-letter words at 1x-5x, five-star
		// should be between 60 (15*25*1*0.8*0.2=60) and 1500 (15*25*5*0.8)
		expect(t.five).toBeGreaterThanOrEqual(60);
		expect(t.five).toBeLessThanOrEqual(1500);
	});
});

describe('getStarRating', () => {
	const thresholds: StarThresholds = { two: 75, three: 150, four: 225, five: 300 };

	it('returns 1 star for score below two-star threshold', () => {
		expect(getStarRating(0, thresholds)).toBe(1);
		expect(getStarRating(74, thresholds)).toBe(1);
	});

	it('returns 2 stars at two-star threshold', () => {
		expect(getStarRating(75, thresholds)).toBe(2);
		expect(getStarRating(149, thresholds)).toBe(2);
	});

	it('returns 3 stars at three-star threshold', () => {
		expect(getStarRating(150, thresholds)).toBe(3);
		expect(getStarRating(224, thresholds)).toBe(3);
	});

	it('returns 4 stars at four-star threshold', () => {
		expect(getStarRating(225, thresholds)).toBe(4);
		expect(getStarRating(299, thresholds)).toBe(4);
	});

	it('returns 5 stars at five-star threshold', () => {
		expect(getStarRating(300, thresholds)).toBe(5);
		expect(getStarRating(99999, thresholds)).toBe(5);
	});

	it('works with real puzzle thresholds', () => {
		const puzzle = generateDailyPuzzle('2026-03-24');
		const t = calculateStarThresholds(puzzle);
		expect(getStarRating(0, t)).toBe(1);
		expect(getStarRating(t.five, t)).toBe(5);
		expect(getStarRating(t.five - 1, t)).toBe(4);
	});
});

describe('puzzleDayNumber', () => {
	it('returns 1 for the epoch date 2026-01-01', () => {
		expect(puzzleDayNumber('2026-01-01')).toBe(1);
	});

	it('returns 2 for 2026-01-02', () => {
		expect(puzzleDayNumber('2026-01-02')).toBe(2);
	});

	it('increments by 1 per day', () => {
		expect(puzzleDayNumber('2026-03-24')).toBe(puzzleDayNumber('2026-03-23') + 1);
	});

	it('is deterministic for the same date', () => {
		expect(puzzleDayNumber('2026-06-15')).toBe(puzzleDayNumber('2026-06-15'));
	});

	it('returns a positive integer for dates after the epoch', () => {
		const n = puzzleDayNumber('2026-12-31');
		expect(Number.isInteger(n)).toBe(true);
		expect(n).toBeGreaterThan(0);
	});

	it('returns 366 for 2027-01-01 (one year after epoch)', () => {
		// 2026 is not a leap year → 365 days → day 366 = 2027-01-01
		expect(puzzleDayNumber('2027-01-01')).toBe(366);
	});
});

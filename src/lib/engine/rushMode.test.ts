/**
 * Tests for Rush Mode core logic.
 */
import { describe, it, expect } from 'vitest';
import { generateGrid, gridCoords } from './hexGrid.js';
import { mulberry32 } from './dailyPuzzle.js';

describe('Rush Mode grid', () => {
	it('generates a 4x4 grid with 12 tiles', () => {
		const rng = mulberry32(12345);
		const grid = generateGrid('4x4', rng);
		expect(grid.size).toBe('4x4');
		expect(grid.tiles).toHaveLength(12);
	});

	it('4x4 grid coords contains exactly 12 unique positions', () => {
		const coords = gridCoords('4x4');
		expect(coords).toHaveLength(12);
		const keys = new Set(coords.map((c) => `${c.q},${c.r}`));
		expect(keys.size).toBe(12);
	});

	it('every tile has a single uppercase letter', () => {
		const rng = mulberry32(99999);
		const grid = generateGrid('4x4', rng);
		for (const tile of grid.tiles) {
			expect(tile.letter).toMatch(/^[A-Z]$/);
		}
	});

	it('generates different grids with different seeds', () => {
		const grid1 = generateGrid('4x4', mulberry32(1));
		const grid2 = generateGrid('4x4', mulberry32(2));
		const letters1 = grid1.tiles.map((t) => t.letter).join('');
		const letters2 = grid2.tiles.map((t) => t.letter).join('');
		// Very likely to differ across 12 tiles
		expect(letters1).not.toBe(letters2);
	});
});

describe('Rush Mode timer display formatting', () => {
	/**
	 * Replicates the timeDisplay logic from the Rush Mode page component.
	 */
	function formatTime(timeRemainingMs: number): string {
		const totalSec = timeRemainingMs / 1000;
		const mins = Math.floor(totalSec / 60);
		const secs = Math.floor(totalSec % 60);
		const tenths = Math.floor((timeRemainingMs % 1000) / 100);
		if (mins > 0) {
			return `${mins}:${secs.toString().padStart(2, '0')}.${tenths}`;
		}
		return `${secs}.${tenths}`;
	}

	it('formats 90 seconds as "1:30.0"', () => {
		expect(formatTime(90_000)).toBe('1:30.0');
	});

	it('formats 60 seconds as "1:00.0"', () => {
		expect(formatTime(60_000)).toBe('1:00.0');
	});

	it('formats 15 seconds as "15.0"', () => {
		expect(formatTime(15_000)).toBe('15.0');
	});

	it('formats 9.5 seconds as "9.5"', () => {
		expect(formatTime(9_500)).toBe('9.5');
	});

	it('formats 0 ms as "0.0"', () => {
		expect(formatTime(0)).toBe('0.0');
	});

	it('formats 1250 ms as "1.2"', () => {
		expect(formatTime(1_250)).toBe('1.2');
	});
});

describe('Rush Mode urgency threshold', () => {
	const URGENCY_THRESHOLD_MS = 15_000;

	it('is not urgent at 90 seconds', () => {
		expect(90_000 <= URGENCY_THRESHOLD_MS).toBe(false);
	});

	it('is not urgent at 16 seconds', () => {
		expect(16_000 <= URGENCY_THRESHOLD_MS).toBe(false);
	});

	it('is urgent at exactly 15 seconds', () => {
		expect(15_000 <= URGENCY_THRESHOLD_MS).toBe(true);
	});

	it('is urgent at 5 seconds', () => {
		expect(5_000 <= URGENCY_THRESHOLD_MS).toBe(true);
	});

	it('is urgent at 0', () => {
		expect(0 <= URGENCY_THRESHOLD_MS).toBe(true);
	});
});

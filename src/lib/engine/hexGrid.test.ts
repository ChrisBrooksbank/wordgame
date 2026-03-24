import { describe, it, expect, beforeEach } from 'vitest';
import {
	hexNeighbors,
	hexEqual,
	hexAdjacent,
	hexKey,
	validatePath,
	hexToPixel,
	hexCorners,
	hexRingCoords,
	gridCoords,
	generateGrid,
	getTile,
	coordInGrid,
	weightedRandomLetter,
	computeGridBounds
} from './hexGrid.js';

describe('hexEqual', () => {
	it('returns true for same coords', () => {
		expect(hexEqual({ q: 1, r: -1 }, { q: 1, r: -1 })).toBe(true);
	});
	it('returns false for different coords', () => {
		expect(hexEqual({ q: 0, r: 0 }, { q: 1, r: 0 })).toBe(false);
	});
});

describe('hexNeighbors', () => {
	it('returns exactly 6 neighbors', () => {
		expect(hexNeighbors({ q: 0, r: 0 })).toHaveLength(6);
	});
	it('neighbors of origin are the 6 direction vectors', () => {
		const n = hexNeighbors({ q: 0, r: 0 });
		expect(n).toContainEqual({ q: 1, r: 0 });
		expect(n).toContainEqual({ q: -1, r: 0 });
		expect(n).toContainEqual({ q: 0, r: 1 });
		expect(n).toContainEqual({ q: 0, r: -1 });
		expect(n).toContainEqual({ q: 1, r: -1 });
		expect(n).toContainEqual({ q: -1, r: 1 });
	});
});

describe('hexAdjacent', () => {
	it('origin is adjacent to its neighbors', () => {
		const origin = { q: 0, r: 0 };
		const neighbors = hexNeighbors(origin);
		for (const n of neighbors) {
			expect(hexAdjacent(origin, n)).toBe(true);
		}
	});
	it('origin is not adjacent to (2,0)', () => {
		expect(hexAdjacent({ q: 0, r: 0 }, { q: 2, r: 0 })).toBe(false);
	});
	it('is symmetric', () => {
		expect(hexAdjacent({ q: 1, r: 0 }, { q: 0, r: 0 })).toBe(true);
	});
});

describe('hexKey', () => {
	it('produces a unique string per coordinate', () => {
		const keys = new Set([
			hexKey({ q: 0, r: 0 }),
			hexKey({ q: 1, r: 0 }),
			hexKey({ q: 0, r: 1 }),
			hexKey({ q: -1, r: 0 })
		]);
		expect(keys.size).toBe(4);
	});
});

describe('validatePath', () => {
	it('single tile is valid', () => {
		expect(validatePath([{ q: 0, r: 0 }])).toBe(true);
	});
	it('two adjacent tiles are valid', () => {
		expect(
			validatePath([
				{ q: 0, r: 0 },
				{ q: 1, r: 0 }
			])
		).toBe(true);
	});
	it('two non-adjacent tiles are invalid', () => {
		expect(
			validatePath([
				{ q: 0, r: 0 },
				{ q: 2, r: 0 }
			])
		).toBe(false);
	});
	it('path with repeated tile is invalid', () => {
		expect(
			validatePath([
				{ q: 0, r: 0 },
				{ q: 1, r: 0 },
				{ q: 0, r: 0 }
			])
		).toBe(false);
	});
	it('valid 3-tile path', () => {
		expect(
			validatePath([
				{ q: 0, r: 0 },
				{ q: 1, r: 0 },
				{ q: 1, r: -1 }
			])
		).toBe(true);
	});
	it('invalid non-adjacent step in middle of path', () => {
		// (0,0) → (1,0) is adjacent, but (1,0) → (3,0) is not
		expect(
			validatePath([
				{ q: 0, r: 0 },
				{ q: 1, r: 0 },
				{ q: 3, r: 0 }
			])
		).toBe(false);
	});
});

describe('hexToPixel', () => {
	it('origin maps to origin pixel', () => {
		const { x, y } = hexToPixel({ q: 0, r: 0 }, 32);
		expect(x).toBeCloseTo(0);
		expect(y).toBeCloseTo(0);
	});
	it('pixel position shifts with q', () => {
		const { x } = hexToPixel({ q: 1, r: 0 }, 32);
		expect(x).toBeGreaterThan(0);
	});
	it('respects origin offset', () => {
		const { x, y } = hexToPixel({ q: 0, r: 0 }, 32, { x: 100, y: 50 });
		expect(x).toBeCloseTo(100);
		expect(y).toBeCloseTo(50);
	});
});

describe('hexCorners', () => {
	it('returns 6 corner points', () => {
		expect(hexCorners({ x: 0, y: 0 }, 32)).toHaveLength(6);
	});
	it('corners are at distance ~size from center', () => {
		const size = 32;
		const corners = hexCorners({ x: 0, y: 0 }, size);
		for (const c of corners) {
			const dist = Math.sqrt(c.x ** 2 + c.y ** 2);
			expect(dist).toBeCloseTo(size, 5);
		}
	});
});

describe('hexRingCoords (radius)', () => {
	it('radius 0 returns just origin', () => {
		const coords = hexRingCoords(0);
		expect(coords).toHaveLength(1);
		expect(coords[0]).toEqual({ q: 0, r: 0 });
	});
	it('radius 1 returns 7 tiles', () => {
		expect(hexRingCoords(1)).toHaveLength(7);
	});
	it('radius 2 returns 19 tiles', () => {
		expect(hexRingCoords(2)).toHaveLength(19);
	});
});

describe('gridCoords', () => {
	it('4x4 returns 12 tiles', () => {
		expect(gridCoords('4x4')).toHaveLength(12);
	});
	it('5x5 returns 19 tiles', () => {
		expect(gridCoords('5x5')).toHaveLength(19);
	});
	it('5x8 returns 40 tiles', () => {
		// 5 cols × 8 rows = 40
		expect(gridCoords('5x8')).toHaveLength(40);
	});
	it('4x4 has no duplicate coordinates', () => {
		const coords = gridCoords('4x4');
		const keys = new Set(coords.map((c) => hexKey(c)));
		expect(keys.size).toBe(coords.length);
	});
	it('5x5 has no duplicate coordinates', () => {
		const coords = gridCoords('5x5');
		const keys = new Set(coords.map((c) => hexKey(c)));
		expect(keys.size).toBe(coords.length);
	});
});

describe('generateGrid', () => {
	// Deterministic RNG for tests
	let seed = 0;
	const mockRng = () => {
		seed = (seed * 1664525 + 1013904223) & 0xffffffff;
		return (seed >>> 0) / 0x100000000;
	};

	beforeEach(() => {
		seed = 42;
	});

	it('generates correct number of tiles for 4x4', () => {
		const grid = generateGrid('4x4', mockRng);
		expect(grid.tiles).toHaveLength(12);
	});
	it('generates correct number of tiles for 5x5', () => {
		const grid = generateGrid('5x5', mockRng);
		expect(grid.tiles).toHaveLength(19);
	});
	it('all tiles have uppercase letter A-Z', () => {
		const grid = generateGrid('5x5', mockRng);
		for (const tile of grid.tiles) {
			expect(tile.letter).toMatch(/^[A-Z]$/);
		}
	});
	it('all tile ids are unique', () => {
		const grid = generateGrid('5x5', mockRng);
		const ids = new Set(grid.tiles.map((t) => t.id));
		expect(ids.size).toBe(grid.tiles.length);
	});
});

describe('getTile / coordInGrid', () => {
	let seed = 0;
	const mockRng = () => {
		seed = (seed * 1664525 + 1013904223) & 0xffffffff;
		return (seed >>> 0) / 0x100000000;
	};

	it('getTile returns tile at known coordinate', () => {
		seed = 0;
		const grid = generateGrid('4x4', mockRng);
		const first = grid.tiles[0];
		const found = getTile(grid, first.coord);
		expect(found).toBeDefined();
		expect(found?.id).toBe(first.id);
	});
	it('getTile returns undefined for out-of-grid coord', () => {
		seed = 0;
		const grid = generateGrid('4x4', mockRng);
		expect(getTile(grid, { q: 999, r: 999 })).toBeUndefined();
	});
	it('coordInGrid returns true for in-grid coord', () => {
		seed = 0;
		const grid = generateGrid('4x4', mockRng);
		expect(coordInGrid(grid, grid.tiles[0].coord)).toBe(true);
	});
	it('coordInGrid returns false for out-of-grid coord', () => {
		seed = 0;
		const grid = generateGrid('4x4', mockRng);
		expect(coordInGrid(grid, { q: 999, r: 999 })).toBe(false);
	});
});

describe('computeGridBounds', () => {
	it('returns zeros for empty coords', () => {
		const bounds = computeGridBounds([], 32);
		expect(bounds).toEqual({ minX: 0, minY: 0, width: 0, height: 0 });
	});

	it('origin-only grid has non-zero width and height from padding', () => {
		const bounds = computeGridBounds([{ q: 0, r: 0 }], 32);
		expect(bounds.width).toBeGreaterThan(0);
		expect(bounds.height).toBeGreaterThan(0);
	});

	it('width grows when more tiles are added horizontally', () => {
		const single = computeGridBounds([{ q: 0, r: 0 }], 32);
		const two = computeGridBounds(
			[
				{ q: 0, r: 0 },
				{ q: 1, r: 0 }
			],
			32
		);
		expect(two.width).toBeGreaterThan(single.width);
	});

	it('respects custom padding', () => {
		const small = computeGridBounds([{ q: 0, r: 0 }], 32, 10);
		const large = computeGridBounds([{ q: 0, r: 0 }], 32, 50);
		expect(large.width).toBeGreaterThan(small.width);
		expect(large.height).toBeGreaterThan(small.height);
	});

	it('5x5 grid bounds contain all tile centers', () => {
		const size = 32;
		const coords = gridCoords('5x5');
		const bounds = computeGridBounds(coords, size);
		for (const coord of coords) {
			const { x, y } = hexToPixel(coord, size);
			expect(x).toBeGreaterThanOrEqual(bounds.minX);
			expect(y).toBeGreaterThanOrEqual(bounds.minY);
			expect(x).toBeLessThanOrEqual(bounds.minX + bounds.width);
			expect(y).toBeLessThanOrEqual(bounds.minY + bounds.height);
		}
	});
});

describe('weightedRandomLetter', () => {
	it('returns a letter A-Z', () => {
		const letter = weightedRandomLetter(Math.random);
		expect(letter).toMatch(/^[A-Z]$/);
	});
	it('E appears more often than Z in a large sample', () => {
		let eCount = 0;
		let zCount = 0;
		const rng = Math.random;
		for (let i = 0; i < 1000; i++) {
			const l = weightedRandomLetter(rng);
			if (l === 'E') eCount++;
			if (l === 'Z') zCount++;
		}
		expect(eCount).toBeGreaterThan(zCount);
	});
});

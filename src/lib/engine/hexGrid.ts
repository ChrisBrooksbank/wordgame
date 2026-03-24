/**
 * Hex grid engine using axial coordinates (q, r) with pointy-top orientation.
 */

export interface HexCoord {
	q: number;
	r: number;
}

export interface HexTile {
	coord: HexCoord;
	letter: string;
	id: string;
}

export interface HexGrid {
	tiles: HexTile[];
	size: GridSize;
}

export type GridSize = '4x4' | '5x5' | '5x8';

/**
 * The 6 axial direction vectors for pointy-top hex grids.
 */
export const HEX_DIRECTIONS: HexCoord[] = [
	{ q: 1, r: 0 },
	{ q: 1, r: -1 },
	{ q: 0, r: -1 },
	{ q: -1, r: 0 },
	{ q: -1, r: 1 },
	{ q: 0, r: 1 }
];

/**
 * Returns the 6 neighbors of a hex tile.
 */
export function hexNeighbors(coord: HexCoord): HexCoord[] {
	return HEX_DIRECTIONS.map((d) => ({ q: coord.q + d.q, r: coord.r + d.r }));
}

/**
 * Returns true if two hex coordinates are equal.
 */
export function hexEqual(a: HexCoord, b: HexCoord): boolean {
	return a.q === b.q && a.r === b.r;
}

/**
 * Returns true if two hex tiles are adjacent (share an edge).
 */
export function hexAdjacent(a: HexCoord, b: HexCoord): boolean {
	return hexNeighbors(a).some((n) => hexEqual(n, b));
}

/**
 * Returns a unique string key for a hex coordinate.
 */
export function hexKey(coord: HexCoord): string {
	return `${coord.q},${coord.r}`;
}

/**
 * Validates that each tile in a path is adjacent to the previous tile,
 * and that no tile appears more than once.
 */
export function validatePath(path: HexCoord[]): boolean {
	if (path.length < 2) return path.length === 1;
	const seen = new Set<string>();
	seen.add(hexKey(path[0]));
	for (let i = 1; i < path.length; i++) {
		const key = hexKey(path[i]);
		if (seen.has(key)) return false;
		if (!hexAdjacent(path[i - 1], path[i])) return false;
		seen.add(key);
	}
	return true;
}

/**
 * Converts axial (q, r) coordinates to SVG pixel coordinates.
 * Uses pointy-top orientation.
 * @param coord  axial hex coordinate
 * @param size   hex tile size (center-to-vertex radius)
 * @param origin pixel origin offset
 */
export function hexToPixel(
	coord: HexCoord,
	size: number,
	origin: { x: number; y: number } = { x: 0, y: 0 }
): { x: number; y: number } {
	const x = size * (Math.sqrt(3) * coord.q + (Math.sqrt(3) / 2) * coord.r) + origin.x;
	const y = size * ((3 / 2) * coord.r) + origin.y;
	return { x, y };
}

/**
 * Returns the 6 corner points of a pointy-top hexagon for SVG polygon rendering.
 */
export function hexCorners(
	center: { x: number; y: number },
	size: number
): { x: number; y: number }[] {
	return Array.from({ length: 6 }, (_, i) => {
		const angleDeg = 60 * i - 30; // pointy-top: start at -30°
		const angleRad = (Math.PI / 180) * angleDeg;
		return {
			x: center.x + size * Math.cos(angleRad),
			y: center.y + size * Math.sin(angleRad)
		};
	});
}

/**
 * Returns the axial coordinates for a "flat hexagonal" shape of a given radius.
 * radius=1 → 7 tiles (center + 6), radius=2 → 19 tiles, etc.
 */
export function hexRingCoords(radius: number): HexCoord[] {
	const coords: HexCoord[] = [];
	for (let q = -radius; q <= radius; q++) {
		const r1 = Math.max(-radius, -q - radius);
		const r2 = Math.min(radius, -q + radius);
		for (let r = r1; r <= r2; r++) {
			// Add 0 to normalize -0 to 0
			coords.push({ q: q + 0, r: r + 0 });
		}
	}
	return coords;
}

// -----------------------------------------------------------------------
// Grid generation for the three supported sizes
// -----------------------------------------------------------------------

/**
 * English letter frequency weights (A–Z).
 */
const LETTER_WEIGHTS: Record<string, number> = {
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

const LETTERS = Object.keys(LETTER_WEIGHTS);
const WEIGHTS = LETTERS.map((l) => LETTER_WEIGHTS[l]);
const TOTAL_WEIGHT = WEIGHTS.reduce((a, b) => a + b, 0);

/**
 * Picks a weighted-random letter from the English frequency distribution.
 */
export function weightedRandomLetter(rng: () => number): string {
	let target = rng() * TOTAL_WEIGHT;
	for (let i = 0; i < LETTERS.length; i++) {
		target -= WEIGHTS[i];
		if (target <= 0) return LETTERS[i];
	}
	return LETTERS[LETTERS.length - 1];
}

/**
 * Generates the axial coordinates for each supported grid size:
 *  - 4x4: offset-row parallelogram-ish shape, 12 tiles
 *  - 5x5: hex blob radius-2, 19 tiles
 *  - 5x8: tall rectangular strip, ~30 tiles
 */
export function gridCoords(size: GridSize): HexCoord[] {
	switch (size) {
		case '4x4':
			return fourByFourCoords();
		case '5x5':
			return hexRingCoords(2); // radius 2 = 19 tiles
		case '5x8':
			return fiveByEightCoords();
	}
}

/** 4x4: 4 columns × 3 rows offset grid = 12 tiles */
function fourByFourCoords(): HexCoord[] {
	const coords: HexCoord[] = [];
	// 3 rows, each row shifts by column offset
	// Row r (0-2), columns 0-3
	for (let r = 0; r < 3; r++) {
		const colCount = r % 2 === 0 ? 4 : 4;
		for (let col = 0; col < colCount; col++) {
			const q = col - Math.floor(r / 2);
			coords.push({ q, r });
		}
	}
	// That gives 12 tiles (4+4+4)
	return coords;
}

/** 5x8: tall grid ~5 columns × 8 rows ≈ 30 tiles */
function fiveByEightCoords(): HexCoord[] {
	const coords: HexCoord[] = [];
	for (let r = 0; r < 8; r++) {
		const colCount = r % 2 === 0 ? 5 : 5;
		for (let col = 0; col < colCount; col++) {
			const q = col - Math.floor(r / 2);
			coords.push({ q, r });
		}
	}
	return coords;
}

/**
 * Generates a HexGrid with random letter tiles.
 * @param size  one of '4x4', '5x5', '5x8'
 * @param rng   random number generator (returns value in [0,1))
 */
export function generateGrid(size: GridSize, rng: () => number): HexGrid {
	const coords = gridCoords(size);
	const tiles: HexTile[] = coords.map((coord, i) => ({
		coord,
		letter: weightedRandomLetter(rng),
		id: `tile-${i}-${hexKey(coord)}`
	}));
	return { tiles, size };
}

/**
 * Computes the bounding box (in SVG pixels) for a set of hex coordinates.
 * Useful for generating a responsive viewBox.
 */
export function computeGridBounds(
	coords: HexCoord[],
	tileSize: number,
	padding = tileSize
): { minX: number; minY: number; width: number; height: number } {
	if (coords.length === 0) {
		return { minX: 0, minY: 0, width: 0, height: 0 };
	}
	const centers = coords.map((c) => hexToPixel(c, tileSize));
	const xs = centers.map((p) => p.x);
	const ys = centers.map((p) => p.y);
	const minX = Math.min(...xs) - padding;
	const minY = Math.min(...ys) - padding;
	const maxX = Math.max(...xs) + padding;
	const maxY = Math.max(...ys) + padding;
	return { minX, minY, width: maxX - minX, height: maxY - minY };
}

/**
 * Looks up a tile by its coordinate. Returns undefined if not found.
 */
export function getTile(grid: HexGrid, coord: HexCoord): HexTile | undefined {
	return grid.tiles.find((t) => hexEqual(t.coord, coord));
}

/**
 * Returns whether a coordinate is present in the grid.
 */
export function coordInGrid(grid: HexGrid, coord: HexCoord): boolean {
	return getTile(grid, coord) !== undefined;
}

/**
 * Core forge mechanic: word submission, tile consumption, gravity, and tile generation.
 */

import type { HexGrid, HexCoord, HexTile } from './hexGrid.js';
import { hexKey, hexEqual, gridCoords, weightedRandomLetter } from './hexGrid.js';
import type { ScoreBreakdown } from './scoring.js';
import { calculateScore } from './scoring.js';

export interface ForgeResult {
	grid: HexGrid;
	score: ScoreBreakdown;
	word: string;
}

export type SubmitFailReason = 'too_short' | 'not_a_word' | 'catalyst_not_used';

export interface SubmitResult {
	success: boolean;
	reason?: SubmitFailReason;
	result?: ForgeResult;
}

/** Counter for unique new-tile IDs. */
let _tileGenCount = 0;

function newTileId(coord: HexCoord): string {
	return `tile-new-${++_tileGenCount}-${hexKey(coord)}`;
}

/**
 * Builds the word string from a path of tile coordinates on the grid.
 * Returns an empty string if any coordinate in the path has no tile.
 */
export function pathToWord(grid: HexGrid, path: HexCoord[]): string {
	return path
		.map((coord) => grid.tiles.find((t) => hexEqual(t.coord, coord))?.letter ?? '')
		.join('');
}

/**
 * Applies gravity to the grid after the tiles at `consumedCoords` are removed.
 *
 * For each q-column (tiles sharing the same q value, sorted by r ascending):
 *  - remaining tiles (not consumed) fall toward the bottom (higher r)
 *  - new random tiles are generated to fill the vacated top positions
 *
 * The relative order of surviving tiles within a column is preserved.
 */
export function applyGravity(
	grid: HexGrid,
	consumedCoords: HexCoord[],
	rng: () => number
): HexGrid {
	const allCoords = gridCoords(grid.size);
	const consumedKeys = new Set(consumedCoords.map(hexKey));

	// Group all valid grid positions by q, sorted by r ascending (top → bottom)
	const columns = new Map<number, HexCoord[]>();
	for (const coord of allCoords) {
		const col = columns.get(coord.q) ?? [];
		col.push(coord);
		columns.set(coord.q, col);
	}
	for (const col of columns.values()) {
		col.sort((a, b) => a.r - b.r);
	}

	const newTiles: HexTile[] = [];

	for (const positions of columns.values()) {
		// Surviving tiles in this column, in top-to-bottom order
		const remaining: HexTile[] = positions
			.filter((pos) => !consumedKeys.has(hexKey(pos)))
			.map((pos) => grid.tiles.find((t) => hexEqual(t.coord, pos))!)
			.filter(Boolean);

		const emptyCount = positions.length - remaining.length;

		for (let i = 0; i < positions.length; i++) {
			if (i < emptyCount) {
				// Top slots: generate new tiles
				newTiles.push({
					coord: positions[i],
					letter: weightedRandomLetter(rng),
					id: newTileId(positions[i])
				});
			} else {
				// Bottom slots: existing tile falls down
				const tile = remaining[i - emptyCount];
				newTiles.push({ ...tile, coord: positions[i] });
			}
		}
	}

	return { tiles: newTiles, size: grid.size };
}

/**
 * Submits a word formed by the given path on the grid.
 *
 * Validation order:
 *  1. Path must contain at least 3 tiles
 *  2. If `catalystCoord` is provided, the path must include that coordinate
 *  3. The word formed must pass `isValidWord`
 *
 * On success, consumes the path tiles and applies gravity to produce the
 * new grid state.
 */
export function submitWord(
	grid: HexGrid,
	path: HexCoord[],
	isValidWord: (word: string) => boolean,
	rng: () => number,
	catalystCoord?: HexCoord
): SubmitResult {
	if (path.length < 3) {
		return { success: false, reason: 'too_short' };
	}

	if (catalystCoord !== undefined) {
		const catalystKey = hexKey(catalystCoord);
		const pathIncludesCatalyst = path.some((coord) => hexKey(coord) === catalystKey);
		if (!pathIncludesCatalyst) {
			return { success: false, reason: 'catalyst_not_used' };
		}
	}

	const word = pathToWord(grid, path);

	if (!isValidWord(word)) {
		return { success: false, reason: 'not_a_word' };
	}

	const newGrid = applyGravity(grid, path, rng);
	const score = calculateScore(word);

	return {
		success: true,
		result: { grid: newGrid, score, word }
	};
}

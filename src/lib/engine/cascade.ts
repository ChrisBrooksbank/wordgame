/**
 * Cascade Mode engine.
 *
 * 5x8 hex grid, 20-move budget, pure strategy (no timer).
 * After each manual word forge, gravity settles tiles and the engine
 * scans for new valid word paths formed by tiles that have fallen.
 * Any found words are auto-forged in escalating chain multipliers.
 *
 * Chain multipliers: chain 1=1x, chain 2=5x, chain 3=12x, chain 4+=30x
 */

import type { HexGrid, HexCoord, HexTile } from './hexGrid.js';
import { generateGrid, hexKey, hexAdjacent, hexEqual } from './hexGrid.js';
import { applyGravity, pathToWord } from './forgeEngine.js';
import { calculateScore } from './scoring.js';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

export const CASCADE_MOVE_BUDGET = 20;

/** Returns the chain multiplier for a 1-based cascade chain number. */
export function getChainMultiplier(chainNumber: number): number {
	if (chainNumber <= 1) return 1;
	if (chainNumber === 2) return 5;
	if (chainNumber === 3) return 12;
	return 30; // 4+
}

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface CascadeWord {
	word: string;
	path: HexCoord[];
	points: number;
	/** 0 = manually forged by player, 1+ = cascade chain number */
	chainNumber: number;
	multiplier: number;
}

export type CascadePhase = 'playing' | 'gameover';

export interface CascadeState {
	phase: CascadePhase;
	grid: HexGrid;
	movesUsed: number;
	score: number;
	/** Points earned from player-forged words only. */
	manualScore: number;
	/** Points earned from auto-cascade words only. */
	cascadeScore: number;
	wordsFound: CascadeWord[];
}

// ---------------------------------------------------------------------------
// Initialization
// ---------------------------------------------------------------------------

export function initialCascadeState(rng: () => number): CascadeState {
	return {
		phase: 'playing',
		grid: generateGrid('5x8', rng),
		movesUsed: 0,
		score: 0,
		manualScore: 0,
		cascadeScore: 0,
		wordsFound: []
	};
}

// ---------------------------------------------------------------------------
// Word detection
// ---------------------------------------------------------------------------

/**
 * Finds the best valid word path on the given grid using DFS with DAWG prefix
 * pruning. "Best" means longest word (highest base score).
 *
 * Only tiles in `eligibleTiles` are considered as candidates.
 * Adjacency is still checked against full grid positions.
 *
 * Returns null if no valid word of 3+ letters exists among eligible tiles.
 */
export function findBestCascadeWord(
	eligibleTiles: HexTile[],
	isWord: (w: string) => boolean,
	isPrefix: (w: string) => boolean
): { word: string; path: HexCoord[] } | null {
	// Build a lookup from coord key → tile for fast access
	const tileByKey = new Map<string, HexTile>();
	for (const tile of eligibleTiles) {
		tileByKey.set(hexKey(tile.coord), tile);
	}

	let best: { word: string; path: HexCoord[] } | null = null;

	function dfs(path: HexCoord[], word: string, usedKeys: Set<string>) {
		if (!isPrefix(word)) return; // prune dead-end prefix

		if (word.length >= 3 && isWord(word)) {
			if (!best || word.length > best.word.length) {
				best = { word, path: [...path] };
			}
		}

		// Limit search depth to avoid excessive computation
		if (word.length >= 10) return;

		const last = path[path.length - 1];
		for (const tile of eligibleTiles) {
			const key = hexKey(tile.coord);
			if (usedKeys.has(key)) continue;
			if (!hexAdjacent(last, tile.coord)) continue;
			usedKeys.add(key);
			path.push(tile.coord);
			dfs(path, word + tile.letter, usedKeys);
			path.pop();
			usedKeys.delete(key);
		}
	}

	for (const tile of eligibleTiles) {
		const key = hexKey(tile.coord);
		const usedKeys = new Set([key]);
		dfs([tile.coord], tile.letter, usedKeys);
	}

	return best;
}

// ---------------------------------------------------------------------------
// Word submission
// ---------------------------------------------------------------------------

export interface SubmitCascadeResult {
	success: boolean;
	reason?: 'too_short' | 'not_a_word';
	/** The word manually forged by the player. */
	manualWord?: CascadeWord;
	/** Cascade words auto-forged after gravity, in chain order. */
	cascadeChain: CascadeWord[];
	/** Total points gained from this submission (manual + cascades). */
	totalPoints: number;
}

/**
 * Submits a manual word forge and processes the full cascade chain.
 *
 * Cascade detection only scans tiles that existed on the board BEFORE the
 * player's forge (identified by tile ID). Newly generated top-fill tiles are
 * excluded from cascade consideration, ensuring cascades arise only from
 * physically falling tiles.
 *
 * Returns the updated state and a detailed result breakdown.
 */
export function submitCascadeWord(
	state: CascadeState,
	path: HexCoord[],
	isWord: (w: string) => boolean,
	isPrefix: (w: string) => boolean,
	rng: () => number
): { newState: CascadeState; result: SubmitCascadeResult } {
	if (state.phase !== 'playing') {
		return {
			newState: state,
			result: { success: false, reason: 'too_short', cascadeChain: [], totalPoints: 0 }
		};
	}

	if (path.length < 3) {
		return {
			newState: state,
			result: { success: false, reason: 'too_short', cascadeChain: [], totalPoints: 0 }
		};
	}

	const word = pathToWord(state.grid, path);
	if (!isWord(word)) {
		return {
			newState: state,
			result: { success: false, reason: 'not_a_word', cascadeChain: [], totalPoints: 0 }
		};
	}

	// Record which tile IDs existed BEFORE the forge — only these are eligible
	// for cascade detection after gravity settles.
	const preForgeTileIds = new Set(state.grid.tiles.map((t) => t.id));
	// Consumed tiles are no longer eligible
	for (const coord of path) {
		const tile = state.grid.tiles.find((t) => hexEqual(t.coord, coord));
		if (tile) preForgeTileIds.delete(tile.id);
	}

	// Forge the manual word
	const manualScoreBreakdown = calculateScore(word);
	const manualWord: CascadeWord = {
		word,
		path,
		points: manualScoreBreakdown.total,
		chainNumber: 0,
		multiplier: 1
	};

	let grid = applyGravity(state.grid, path, rng);
	const cascadeChain: CascadeWord[] = [];
	let cascadeScore = 0;

	// Process cascade chain — only eligible (pre-forge) tiles are scanned
	for (let chainNum = 1; chainNum <= 20; chainNum++) {
		const eligibleTiles = grid.tiles.filter((t) => preForgeTileIds.has(t.id));
		if (eligibleTiles.length === 0) break;

		const found = findBestCascadeWord(eligibleTiles, isWord, isPrefix);
		if (!found) break;

		const multiplier = getChainMultiplier(chainNum);
		const cascadeScoreBreakdown = calculateScore(found.word);
		const points = cascadeScoreBreakdown.total * multiplier;

		cascadeChain.push({
			word: found.word,
			path: found.path,
			points,
			chainNumber: chainNum,
			multiplier
		});

		cascadeScore += points;

		// Remove consumed tile IDs from eligibility for subsequent chains
		for (const coord of found.path) {
			const tile = eligibleTiles.find((t) => hexEqual(t.coord, coord));
			if (tile) preForgeTileIds.delete(tile.id);
		}

		grid = applyGravity(grid, found.path, rng);
	}

	const totalPoints = manualScoreBreakdown.total + cascadeScore;
	const newMovesUsed = state.movesUsed + 1;
	const newPhase: CascadePhase = newMovesUsed >= CASCADE_MOVE_BUDGET ? 'gameover' : 'playing';

	const newState: CascadeState = {
		phase: newPhase,
		grid,
		movesUsed: newMovesUsed,
		score: state.score + totalPoints,
		manualScore: state.manualScore + manualScoreBreakdown.total,
		cascadeScore: state.cascadeScore + cascadeScore,
		wordsFound: [...state.wordsFound, manualWord, ...cascadeChain]
	};

	return {
		newState,
		result: {
			success: true,
			manualWord,
			cascadeChain,
			totalPoints
		}
	};
}

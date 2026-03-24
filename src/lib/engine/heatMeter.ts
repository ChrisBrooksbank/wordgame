/**
 * Heat Meter system for Rush Mode.
 *
 * Heat fills as the player finds words and maintains combo streaks.
 * At max heat (variable-ratio threshold), all tiles that are part of
 * available 5+ letter words are briefly highlighted for 3 seconds.
 * Heat decays over time when no words are found.
 */

import { hexKey, hexAdjacent } from './hexGrid.js';
import type { HexGrid, HexCoord } from './hexGrid.js';

// -------------------------------------------------------------------------
// Constants
// -------------------------------------------------------------------------

export const HEAT_ACTIVATION_DURATION_MS = 3_000;
/** Heat decay per second when not active. */
export const HEAT_DECAY_PER_SECOND = 0.06;
/** Minimum possible activation threshold (variable-ratio lower bound). */
export const MIN_HEAT_THRESHOLD = 0.7;
/** Base heat gain per word. */
export const HEAT_GAIN_BASE = 0.12;
/** Extra heat gain per letter beyond 3. */
export const HEAT_GAIN_PER_EXTRA_LETTER = 0.02;
/** Extra heat gain per combo level above 1x. */
export const HEAT_GAIN_PER_COMBO_LEVEL = 0.05;
/** Minimum word length to qualify for tile highlight. */
export const HEAT_MIN_WORD_LENGTH = 5;

// -------------------------------------------------------------------------
// State
// -------------------------------------------------------------------------

export interface HeatState {
	/** Current heat level 0–1. */
	heat: number;
	/** Randomly sampled threshold at which activation fires (MIN_HEAT_THRESHOLD–1). */
	activationThreshold: number;
	/** Whether the highlight window is currently active. */
	isActive: boolean;
	/** Timestamp (ms) when the active highlight window ends, or null. */
	activationEndsMs: number | null;
}

function sampleThreshold(rng: () => number): number {
	return MIN_HEAT_THRESHOLD + rng() * (1 - MIN_HEAT_THRESHOLD);
}

export function initialHeatState(rng: () => number): HeatState {
	return {
		heat: 0,
		activationThreshold: sampleThreshold(rng),
		isActive: false,
		activationEndsMs: null
	};
}

// -------------------------------------------------------------------------
// Heat updates
// -------------------------------------------------------------------------

/**
 * Record a successfully found word.
 *
 * Returns the updated state and whether an activation was triggered.
 */
export function addHeat(
	state: HeatState,
	wordLength: number,
	comboMultiplier: number,
	nowMs: number,
	rng: () => number
): { newState: HeatState; triggered: boolean } {
	const gain =
		HEAT_GAIN_BASE +
		Math.max(0, wordLength - 3) * HEAT_GAIN_PER_EXTRA_LETTER +
		(comboMultiplier - 1) * HEAT_GAIN_PER_COMBO_LEVEL;

	let heat = Math.min(1, state.heat + gain);
	let { activationThreshold, isActive, activationEndsMs } = state;
	let triggered = false;

	if (!isActive && heat >= activationThreshold) {
		triggered = true;
		isActive = true;
		activationEndsMs = nowMs + HEAT_ACTIVATION_DURATION_MS;
		heat = 0;
		activationThreshold = sampleThreshold(rng);
	}

	return {
		newState: { heat, activationThreshold, isActive, activationEndsMs },
		triggered
	};
}

/**
 * Advance the heat meter by `elapsedMs` milliseconds.
 *
 * Decays heat when inactive; ends the activation window when its timer expires.
 */
export function tickHeat(state: HeatState, elapsedMs: number, nowMs: number): HeatState {
	let { heat, activationThreshold, isActive, activationEndsMs } = state;

	if (isActive && activationEndsMs !== null && nowMs >= activationEndsMs) {
		isActive = false;
		activationEndsMs = null;
	}

	if (!isActive) {
		heat = Math.max(0, heat - HEAT_DECAY_PER_SECOND * (elapsedMs / 1000));
	}

	return { heat, activationThreshold, isActive, activationEndsMs };
}

// -------------------------------------------------------------------------
// Tile discovery
// -------------------------------------------------------------------------

/**
 * Returns the set of tile keys (hexKey) that are part of any valid word path
 * of at least `minLength` letters on the given grid.
 *
 * Uses DAWG prefix pruning so the DFS terminates quickly on dead-end paths.
 */
export function findLongWordTiles(
	grid: HexGrid,
	isWord: (w: string) => boolean,
	isPrefix: (w: string) => boolean,
	minLength = HEAT_MIN_WORD_LENGTH
): Set<string> {
	const result = new Set<string>();

	function dfs(path: HexCoord[], word: string, pathKeys: Set<string>) {
		if (!isPrefix(word)) return; // prune: no word starts with this prefix

		if (word.length >= minLength && isWord(word)) {
			for (const c of path) result.add(hexKey(c));
		}

		// Early exit: all tiles already highlighted
		if (result.size === grid.tiles.length) return;

		const last = path[path.length - 1];
		for (const tile of grid.tiles) {
			const key = hexKey(tile.coord);
			if (pathKeys.has(key)) continue;
			if (!hexAdjacent(last, tile.coord)) continue;
			pathKeys.add(key);
			dfs([...path, tile.coord], word + tile.letter, pathKeys);
			pathKeys.delete(key);
		}
	}

	for (const tile of grid.tiles) {
		const startKey = hexKey(tile.coord);
		dfs([tile.coord], tile.letter, new Set([startKey]));
		if (result.size === grid.tiles.length) break;
	}

	return result;
}

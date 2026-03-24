/**
 * Memory Crucible engine.
 *
 * View phase: tiles visible for a decreasing duration each round.
 * Play phase: tiles hidden; player traces paths from memory.
 * Strike: submitting a path that is not a valid word.
 * Game over: 3 strikes OR 30-second play-phase timeout.
 *
 * Round view durations (ms): 8000 → 6000 → 4000 → 3000 → 2000 (clamped)
 */

import type { HexGrid, HexCoord } from './hexGrid.js';
import { generateGrid } from './hexGrid.js';
import { calculateScore } from './scoring.js';
import { pathToWord, applyGravity } from './forgeEngine.js';

export type MemoryPhase = 'view' | 'play' | 'gameover';

export const MAX_STRIKES = 3;
export const ROUND_PLAY_TIMEOUT_MS = 30_000;

/** View durations per round (ms). Clamped to last value after round 5. */
export const VIEW_DURATIONS_MS: number[] = [8000, 6000, 4000, 3000, 2000];

/** Returns the view duration (ms) for a given 1-based round number. */
export function getViewDuration(round: number): number {
	const idx = Math.min(round - 1, VIEW_DURATIONS_MS.length - 1);
	return VIEW_DURATIONS_MS[idx];
}

export interface MemoryCrucibleState {
	phase: MemoryPhase;
	round: number;
	strikes: number;
	score: number;
	wordsFound: { word: string; points: number }[];
	grid: HexGrid;
	/** Remaining view-phase time (ms). Only meaningful when phase === 'view'. */
	viewTimerMs: number;
	/** Remaining play-phase time (ms). Only meaningful when phase === 'play'. */
	roundTimerMs: number;
}

/** Creates the initial game state for round 1. */
export function initialMemoryState(rng: () => number): MemoryCrucibleState {
	const grid = generateGrid('4x4', rng);
	return {
		phase: 'view',
		round: 1,
		strikes: 0,
		score: 0,
		wordsFound: [],
		grid,
		viewTimerMs: getViewDuration(1),
		roundTimerMs: ROUND_PLAY_TIMEOUT_MS
	};
}

/**
 * Advances the game clock by `elapsedMs` milliseconds.
 * Handles phase transitions:
 *  - view timer → 0: transitions to play phase
 *  - round timer → 0: transitions to gameover
 */
export function tickMemory(state: MemoryCrucibleState, elapsedMs: number): MemoryCrucibleState {
	if (state.phase === 'gameover') return state;

	if (state.phase === 'view') {
		const viewTimerMs = Math.max(0, state.viewTimerMs - elapsedMs);
		if (viewTimerMs === 0) {
			return { ...state, viewTimerMs: 0, phase: 'play' };
		}
		return { ...state, viewTimerMs };
	}

	// play phase
	const roundTimerMs = Math.max(0, state.roundTimerMs - elapsedMs);
	if (roundTimerMs === 0) {
		return { ...state, roundTimerMs: 0, phase: 'gameover' };
	}
	return { ...state, roundTimerMs };
}

export type SubmitMemoryFailReason = 'too_short' | 'not_a_word' | 'wrong_phase';

export type SubmitMemoryResult =
	| { success: true; points: number; word: string; newState: MemoryCrucibleState }
	| { success: false; reason: SubmitMemoryFailReason; newState: MemoryCrucibleState };

/**
 * Submits a word attempt during the play phase.
 *
 * Success: score awarded, grid refilled via gravity, new round begins (view phase).
 * Failure: strike added; 3 strikes → game over.
 */
export function submitMemoryWord(
	state: MemoryCrucibleState,
	path: HexCoord[],
	isValidWord: (word: string) => boolean,
	rng: () => number
): SubmitMemoryResult {
	if (state.phase !== 'play') {
		return { success: false, reason: 'wrong_phase', newState: state };
	}

	if (path.length < 3) {
		return { success: false, reason: 'too_short', newState: state };
	}

	const word = pathToWord(state.grid, path);

	if (!isValidWord(word)) {
		const strikes = state.strikes + 1;
		const phase: MemoryPhase = strikes >= MAX_STRIKES ? 'gameover' : 'play';
		return {
			success: false,
			reason: 'not_a_word',
			newState: { ...state, strikes, phase }
		};
	}

	// Valid word: score it, rebuild grid, start next round in view phase
	const scoreBreakdown = calculateScore(word);
	const points = scoreBreakdown.total;
	const newGrid = applyGravity(state.grid, path, rng);
	const round = state.round + 1;

	const newState: MemoryCrucibleState = {
		...state,
		score: state.score + points,
		wordsFound: [...state.wordsFound, { word, points }],
		grid: newGrid,
		round,
		phase: 'view',
		viewTimerMs: getViewDuration(round),
		roundTimerMs: ROUND_PLAY_TIMEOUT_MS
	};

	return { success: true, points, word, newState };
}

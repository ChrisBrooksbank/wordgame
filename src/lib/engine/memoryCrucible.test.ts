import { describe, it, expect } from 'vitest';
import {
	getViewDuration,
	initialMemoryState,
	tickMemory,
	submitMemoryWord,
	MAX_STRIKES,
	ROUND_PLAY_TIMEOUT_MS,
	VIEW_DURATIONS_MS
} from './memoryCrucible.js';
import type { MemoryCrucibleState } from './memoryCrucible.js';

/** Deterministic RNG that always returns 0 (selects first letter). */
const deterministicRng = () => 0;

describe('getViewDuration', () => {
	it('returns 8000 for round 1', () => {
		expect(getViewDuration(1)).toBe(8000);
	});

	it('returns 6000 for round 2', () => {
		expect(getViewDuration(2)).toBe(6000);
	});

	it('returns 2000 for round 5 and beyond', () => {
		expect(getViewDuration(5)).toBe(2000);
		expect(getViewDuration(10)).toBe(2000);
		expect(getViewDuration(100)).toBe(2000);
	});

	it('covers all defined durations', () => {
		VIEW_DURATIONS_MS.forEach((dur, i) => {
			expect(getViewDuration(i + 1)).toBe(dur);
		});
	});
});

describe('initialMemoryState', () => {
	it('starts in view phase, round 1, zero strikes and score', () => {
		const state = initialMemoryState(deterministicRng);
		expect(state.phase).toBe('view');
		expect(state.round).toBe(1);
		expect(state.strikes).toBe(0);
		expect(state.score).toBe(0);
		expect(state.wordsFound).toHaveLength(0);
	});

	it('sets viewTimerMs to round-1 duration', () => {
		const state = initialMemoryState(deterministicRng);
		expect(state.viewTimerMs).toBe(getViewDuration(1));
	});

	it('sets roundTimerMs to play timeout', () => {
		const state = initialMemoryState(deterministicRng);
		expect(state.roundTimerMs).toBe(ROUND_PLAY_TIMEOUT_MS);
	});

	it('creates a 4x4 grid with 12 tiles', () => {
		const state = initialMemoryState(deterministicRng);
		expect(state.grid.size).toBe('4x4');
		expect(state.grid.tiles).toHaveLength(12);
	});
});

describe('tickMemory — view phase', () => {
	it('decrements viewTimerMs', () => {
		const state = initialMemoryState(deterministicRng);
		const next = tickMemory(state, 1000);
		expect(next.viewTimerMs).toBe(state.viewTimerMs - 1000);
		expect(next.phase).toBe('view');
	});

	it('transitions to play phase when viewTimerMs reaches 0', () => {
		const state = initialMemoryState(deterministicRng);
		const next = tickMemory(state, state.viewTimerMs);
		expect(next.phase).toBe('play');
		expect(next.viewTimerMs).toBe(0);
	});

	it('clamps viewTimerMs at 0 (no negative)', () => {
		const state = initialMemoryState(deterministicRng);
		const next = tickMemory(state, state.viewTimerMs + 5000);
		expect(next.viewTimerMs).toBe(0);
		expect(next.phase).toBe('play');
	});

	it('does not decrement roundTimerMs during view phase', () => {
		const state = initialMemoryState(deterministicRng);
		const next = tickMemory(state, 1000);
		expect(next.roundTimerMs).toBe(state.roundTimerMs);
	});
});

describe('tickMemory — play phase', () => {
	function inPlayPhase(): MemoryCrucibleState {
		const state = initialMemoryState(deterministicRng);
		return tickMemory(state, state.viewTimerMs);
	}

	it('decrements roundTimerMs', () => {
		const state = inPlayPhase();
		const next = tickMemory(state, 1000);
		expect(next.roundTimerMs).toBe(state.roundTimerMs - 1000);
		expect(next.phase).toBe('play');
	});

	it('transitions to gameover when roundTimerMs reaches 0', () => {
		const state = inPlayPhase();
		const next = tickMemory(state, state.roundTimerMs);
		expect(next.phase).toBe('gameover');
		expect(next.roundTimerMs).toBe(0);
	});
});

describe('tickMemory — gameover phase', () => {
	it('returns the same state unchanged', () => {
		const state: MemoryCrucibleState = {
			...initialMemoryState(deterministicRng),
			phase: 'gameover'
		};
		const next = tickMemory(state, 5000);
		expect(next).toBe(state);
	});
});

describe('submitMemoryWord', () => {
	/** Move directly to play phase. */
	function playState(): MemoryCrucibleState {
		const s = initialMemoryState(deterministicRng);
		return { ...s, phase: 'play' };
	}

	it('returns wrong_phase when not in play phase', () => {
		const state = initialMemoryState(deterministicRng); // view phase
		const result = submitMemoryWord(state, [], () => true, deterministicRng);
		expect(result.success).toBe(false);
		if (!result.success) expect(result.reason).toBe('wrong_phase');
	});

	it('returns too_short for path < 3', () => {
		const state = playState();
		const path = [
			{ q: 0, r: 0 },
			{ q: 1, r: 0 }
		];
		const result = submitMemoryWord(state, path, () => true, deterministicRng);
		expect(result.success).toBe(false);
		if (!result.success) expect(result.reason).toBe('too_short');
		// No strike for too_short
		expect(result.newState.strikes).toBe(0);
	});

	it('adds a strike for a non-word and stays in play', () => {
		const state = playState();
		const path = [
			{ q: 0, r: 0 },
			{ q: 1, r: 0 },
			{ q: 0, r: 1 }
		];
		const result = submitMemoryWord(state, path, () => false, deterministicRng);
		expect(result.success).toBe(false);
		if (!result.success) expect(result.reason).toBe('not_a_word');
		expect(result.newState.strikes).toBe(1);
		expect(result.newState.phase).toBe('play');
	});

	it(`triggers gameover on ${MAX_STRIKES}rd strike`, () => {
		let state: MemoryCrucibleState = { ...playState(), strikes: MAX_STRIKES - 1 };
		const path = [
			{ q: 0, r: 0 },
			{ q: 1, r: 0 },
			{ q: 0, r: 1 }
		];
		const result = submitMemoryWord(state, path, () => false, deterministicRng);
		expect(result.newState.phase).toBe('gameover');
		expect(result.newState.strikes).toBe(MAX_STRIKES);
	});

	it('awards points and advances round on success', () => {
		const state = playState();
		// Use grid tiles from the state to build a real path
		const tiles = state.grid.tiles.slice(0, 3);
		const path = tiles.map((t) => t.coord);
		const result = submitMemoryWord(state, path, () => true, deterministicRng);
		expect(result.success).toBe(true);
		if (result.success) {
			expect(result.points).toBeGreaterThan(0);
			expect(result.newState.score).toBe(result.points);
			expect(result.newState.round).toBe(state.round + 1);
			expect(result.newState.phase).toBe('view');
			expect(result.newState.wordsFound).toHaveLength(1);
		}
	});

	it('resets roundTimerMs when advancing to next round', () => {
		const state: MemoryCrucibleState = { ...playState(), roundTimerMs: 5000 };
		const tiles = state.grid.tiles.slice(0, 3);
		const path = tiles.map((t) => t.coord);
		const result = submitMemoryWord(state, path, () => true, deterministicRng);
		if (result.success) {
			expect(result.newState.roundTimerMs).toBe(ROUND_PLAY_TIMEOUT_MS);
		}
	});

	it('uses decreasing view duration for higher rounds', () => {
		const state = playState();
		const tiles = state.grid.tiles.slice(0, 3);
		const path = tiles.map((t) => t.coord);

		let current = state;
		for (let round = 2; round <= 6; round++) {
			const result = submitMemoryWord(current, path, () => true, deterministicRng);
			expect(result.success).toBe(true);
			if (result.success) {
				expect(result.newState.viewTimerMs).toBe(getViewDuration(round));
				current = { ...result.newState, phase: 'play' };
			}
		}
	});
});

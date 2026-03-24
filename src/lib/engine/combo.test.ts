/**
 * Tests for the Rush Mode combo system.
 */
import { describe, it, expect } from 'vitest';
import {
	initialComboState,
	recordWord,
	getComboProgress,
	isComboExpired,
	COMBO_WINDOW_MS,
	MAX_COMBO
} from './combo.js';

describe('initialComboState', () => {
	it('starts at 1x with no last word', () => {
		const state = initialComboState();
		expect(state.multiplier).toBe(1);
		expect(state.lastWordMs).toBeNull();
	});
});

describe('recordWord', () => {
	it('first word always gives 1x multiplier', () => {
		const state = initialComboState();
		const { multiplier } = recordWord(state, 1000);
		expect(multiplier).toBe(1);
	});

	it('second word within window increases to 2x', () => {
		let state = initialComboState();
		({ newState: state } = recordWord(state, 1000));
		const { multiplier } = recordWord(state, 1000 + COMBO_WINDOW_MS - 1);
		expect(multiplier).toBe(2);
	});

	it('second word exactly at window boundary (= COMBO_WINDOW_MS) still counts', () => {
		let state = initialComboState();
		({ newState: state } = recordWord(state, 1000));
		const { multiplier } = recordWord(state, 1000 + COMBO_WINDOW_MS);
		expect(multiplier).toBe(2);
	});

	it('second word after window resets to 1x', () => {
		let state = initialComboState();
		({ newState: state } = recordWord(state, 1000));
		const { multiplier } = recordWord(state, 1000 + COMBO_WINDOW_MS + 1);
		expect(multiplier).toBe(1);
	});

	it('builds up to 5x with successive words in window', () => {
		let state = initialComboState();
		let nowMs = 0;
		const multipliers: number[] = [];
		for (let i = 0; i < 6; i++) {
			const result = recordWord(state, nowMs);
			multipliers.push(result.multiplier);
			state = result.newState;
			nowMs += 1000; // 1s apart, well within window
		}
		expect(multipliers).toEqual([1, 2, 3, 4, 5, 5]);
	});

	it('caps at MAX_COMBO (5x)', () => {
		let state = initialComboState();
		let nowMs = 0;
		for (let i = 0; i < 10; i++) {
			const result = recordWord(state, nowMs);
			state = result.newState;
			nowMs += 500;
		}
		expect(state.multiplier).toBe(MAX_COMBO);
	});

	it('resets after gap, then builds again', () => {
		let state = initialComboState();
		let nowMs = 0;

		// Build to 3x
		for (let i = 0; i < 3; i++) {
			({ newState: state } = recordWord(state, nowMs));
			nowMs += 1000;
		}
		expect(state.multiplier).toBe(3);

		// Gap — reset
		nowMs += COMBO_WINDOW_MS + 500;
		const { multiplier: resetMultiplier, newState: afterReset } = recordWord(state, nowMs);
		expect(resetMultiplier).toBe(1);
		expect(afterReset.multiplier).toBe(1);
	});

	it('updates lastWordMs to nowMs', () => {
		const state = initialComboState();
		const { newState } = recordWord(state, 5000);
		expect(newState.lastWordMs).toBe(5000);
	});
});

describe('getComboProgress', () => {
	it('returns 0 when no words found', () => {
		const state = initialComboState();
		expect(getComboProgress(state, 1000)).toBe(0);
	});

	it('returns 1 immediately after recording a word', () => {
		let state = initialComboState();
		({ newState: state } = recordWord(state, 1000));
		expect(getComboProgress(state, 1000)).toBe(1);
	});

	it('returns ~0.5 halfway through window', () => {
		let state = initialComboState();
		({ newState: state } = recordWord(state, 0));
		const progress = getComboProgress(state, COMBO_WINDOW_MS / 2);
		expect(progress).toBeCloseTo(0.5);
	});

	it('returns 0 after window expires', () => {
		let state = initialComboState();
		({ newState: state } = recordWord(state, 0));
		expect(getComboProgress(state, COMBO_WINDOW_MS + 1)).toBe(0);
	});
});

describe('isComboExpired', () => {
	it('returns true when no words found yet', () => {
		expect(isComboExpired(initialComboState(), 1000)).toBe(true);
	});

	it('returns false immediately after recording a word', () => {
		let state = initialComboState();
		({ newState: state } = recordWord(state, 1000));
		expect(isComboExpired(state, 1000)).toBe(false);
	});

	it('returns false within window', () => {
		let state = initialComboState();
		({ newState: state } = recordWord(state, 0));
		expect(isComboExpired(state, COMBO_WINDOW_MS)).toBe(false);
	});

	it('returns true after window expires', () => {
		let state = initialComboState();
		({ newState: state } = recordWord(state, 0));
		expect(isComboExpired(state, COMBO_WINDOW_MS + 1)).toBe(true);
	});
});

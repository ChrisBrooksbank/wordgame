/**
 * Combo system for Rush Mode.
 *
 * Finding a word within 3 seconds of the previous word increases the combo
 * multiplier (1x → 2x → 3x → 4x → 5x). More than 3 seconds of inactivity
 * resets the multiplier back to 1x.
 */

export const COMBO_WINDOW_MS = 3_000;
export const MAX_COMBO = 5;

export interface ComboState {
	/** Current multiplier: 1–5. */
	multiplier: number;
	/** Timestamp (ms) when the last word was found, or null if no word yet. */
	lastWordMs: number | null;
}

export function initialComboState(): ComboState {
	return { multiplier: 1, lastWordMs: null };
}

/**
 * Record a successfully found word.
 *
 * Returns the multiplier that applies to this word (already accounting for
 * the combo streak), plus the updated state for subsequent words.
 */
export function recordWord(
	state: ComboState,
	nowMs: number
): { multiplier: number; newState: ComboState } {
	const isInWindow = state.lastWordMs !== null && nowMs - state.lastWordMs <= COMBO_WINDOW_MS;
	const multiplier = isInWindow ? Math.min(state.multiplier + 1, MAX_COMBO) : 1;
	return {
		multiplier,
		newState: { multiplier, lastWordMs: nowMs }
	};
}

/**
 * Returns how much of the combo window remains as a fraction 0→1.
 * 1.0 = window just opened; 0.0 = window closed / no active combo.
 */
export function getComboProgress(state: ComboState, nowMs: number): number {
	if (state.lastWordMs === null) return 0;
	const elapsed = nowMs - state.lastWordMs;
	if (elapsed > COMBO_WINDOW_MS) return 0;
	return 1 - elapsed / COMBO_WINDOW_MS;
}

/**
 * Returns true if the combo window has expired and the next word will
 * reset the multiplier to 1x.
 */
export function isComboExpired(state: ComboState, nowMs: number): boolean {
	if (state.lastWordMs === null) return true;
	return nowMs - state.lastWordMs > COMBO_WINDOW_MS;
}

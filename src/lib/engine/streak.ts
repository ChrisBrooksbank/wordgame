/**
 * Streak system for Daily Forge mode.
 *
 * Tracks consecutive days played, awards shields every 7 days (max 3),
 * and auto-consumes shields to protect against missed days.
 */

import { get as idbGet, set as idbSet } from 'idb-keyval';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface StreakState {
	/** Number of consecutive days played (may be protected by shields). */
	currentStreak: number;
	/** Shields available to auto-protect missed days (0–3). */
	shieldBank: number;
	/** UTC date string (YYYY-MM-DD) of the most recent completed puzzle, or null. */
	lastPlayedDate: string | null;
	/** All-time longest streak achieved. */
	longestStreak: number;
}

// ---------------------------------------------------------------------------
// Defaults & IDB key
// ---------------------------------------------------------------------------

export const DEFAULT_STREAK_STATE: StreakState = {
	currentStreak: 0,
	shieldBank: 0,
	lastPlayedDate: null,
	longestStreak: 0
};

export const STREAK_STATE_KEY = 'lexicon-forge:streak-state';

// ---------------------------------------------------------------------------
// Persistence
// ---------------------------------------------------------------------------

export async function saveStreakState(state: StreakState): Promise<void> {
	await idbSet(STREAK_STATE_KEY, state);
}

export async function loadStreakState(): Promise<StreakState> {
	const stored = await idbGet<StreakState>(STREAK_STATE_KEY);
	return stored ?? DEFAULT_STREAK_STATE;
}

// ---------------------------------------------------------------------------
// Pure logic helpers
// ---------------------------------------------------------------------------

/** Returns the number of calendar days between two UTC date strings. */
function dateDiffDays(from: string, to: string): number {
	const parse = (d: string): number => {
		const [y, m, day] = d.split('-').map(Number);
		return Date.UTC(y, m - 1, day);
	};
	return Math.round((parse(to) - parse(from)) / 86_400_000);
}

// ---------------------------------------------------------------------------
// Core streak update
// ---------------------------------------------------------------------------

/**
 * Returns the updated streak state after recording a completed puzzle on `date`.
 *
 * Rules:
 * - Playing the same date twice is a no-op.
 * - Consecutive day (diff === 1): increment streak.
 * - Missed days: consume one shield per missed day; if insufficient shields, reset streak to 1.
 * - Every time the streak crosses a multiple of 7, bank one extra shield (cap 3).
 * - Shield awards happen *after* any shield usage for missed days.
 */
export function recordDailyPlay(streak: StreakState, date: string): StreakState {
	// Already recorded for this date — no-op
	if (streak.lastPlayedDate === date) return streak;

	// First play ever
	if (streak.lastPlayedDate === null) {
		return {
			currentStreak: 1,
			shieldBank: streak.shieldBank,
			lastPlayedDate: date,
			longestStreak: Math.max(streak.longestStreak, 1)
		};
	}

	const diff = dateDiffDays(streak.lastPlayedDate, date);

	// Played in the past (clock skew, replay attack, etc.) — ignore
	if (diff <= 0) return streak;

	const missedDays = diff - 1;

	let newStreak: number;
	let newShieldBank = streak.shieldBank;

	if (missedDays === 0) {
		// Consecutive day
		newStreak = streak.currentStreak + 1;
	} else if (missedDays <= streak.shieldBank) {
		// Shields cover all missed days
		newShieldBank = streak.shieldBank - missedDays;
		newStreak = streak.currentStreak + 1;
	} else {
		// Streak broken — reset
		newStreak = 1;
	}

	// Award one shield per 7-day milestone crossed (cap at 3)
	const oldMilestone = Math.floor(streak.currentStreak / 7);
	const newMilestone = Math.floor(newStreak / 7);
	const milestonesGained = Math.max(0, newMilestone - oldMilestone);
	newShieldBank = Math.min(3, newShieldBank + milestonesGained);

	return {
		currentStreak: newStreak,
		shieldBank: newShieldBank,
		lastPlayedDate: date,
		longestStreak: Math.max(streak.longestStreak, newStreak)
	};
}

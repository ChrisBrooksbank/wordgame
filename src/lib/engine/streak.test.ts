import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock idb-keyval before importing the module
const mockStore = new Map<string, unknown>();

vi.mock('idb-keyval', () => ({
	get: vi.fn(async (key: string) => mockStore.get(key)),
	set: vi.fn(async (key: string, value: unknown) => {
		mockStore.set(key, value);
	})
}));

import {
	recordDailyPlay,
	saveStreakState,
	loadStreakState,
	DEFAULT_STREAK_STATE,
	STREAK_STATE_KEY,
	type StreakState
} from './streak.js';

beforeEach(() => {
	mockStore.clear();
});

// ---------------------------------------------------------------------------
// recordDailyPlay — first play
// ---------------------------------------------------------------------------

describe('recordDailyPlay — first play', () => {
	it('starts streak at 1 on first play', () => {
		const result = recordDailyPlay(DEFAULT_STREAK_STATE, '2026-03-24');
		expect(result.currentStreak).toBe(1);
	});

	it('sets lastPlayedDate to the played date', () => {
		const result = recordDailyPlay(DEFAULT_STREAK_STATE, '2026-03-24');
		expect(result.lastPlayedDate).toBe('2026-03-24');
	});

	it('sets longestStreak to 1 on first play', () => {
		const result = recordDailyPlay(DEFAULT_STREAK_STATE, '2026-03-24');
		expect(result.longestStreak).toBe(1);
	});

	it('does not change shieldBank on first play', () => {
		const result = recordDailyPlay(DEFAULT_STREAK_STATE, '2026-03-24');
		expect(result.shieldBank).toBe(0);
	});
});

// ---------------------------------------------------------------------------
// recordDailyPlay — consecutive days
// ---------------------------------------------------------------------------

describe('recordDailyPlay — consecutive days', () => {
	const base: StreakState = {
		currentStreak: 5,
		shieldBank: 0,
		lastPlayedDate: '2026-03-23',
		longestStreak: 5
	};

	it('increments streak on consecutive day', () => {
		const result = recordDailyPlay(base, '2026-03-24');
		expect(result.currentStreak).toBe(6);
	});

	it('updates lastPlayedDate', () => {
		const result = recordDailyPlay(base, '2026-03-24');
		expect(result.lastPlayedDate).toBe('2026-03-24');
	});

	it('updates longestStreak when current exceeds it', () => {
		const state: StreakState = { ...base, longestStreak: 3 };
		const result = recordDailyPlay(state, '2026-03-24');
		expect(result.longestStreak).toBe(6);
	});

	it('keeps longestStreak when it is already higher', () => {
		const state: StreakState = { ...base, currentStreak: 5, longestStreak: 20 };
		const result = recordDailyPlay(state, '2026-03-24');
		expect(result.longestStreak).toBe(20);
	});
});

// ---------------------------------------------------------------------------
// recordDailyPlay — same day (no-op)
// ---------------------------------------------------------------------------

describe('recordDailyPlay — same day', () => {
	it('is a no-op when date matches lastPlayedDate', () => {
		const base: StreakState = {
			currentStreak: 3,
			shieldBank: 1,
			lastPlayedDate: '2026-03-24',
			longestStreak: 3
		};
		const result = recordDailyPlay(base, '2026-03-24');
		expect(result).toBe(base); // same reference
	});
});

// ---------------------------------------------------------------------------
// recordDailyPlay — missed days with shields
// ---------------------------------------------------------------------------

describe('recordDailyPlay — missed day, shield available', () => {
	it('uses one shield for one missed day and maintains streak', () => {
		const base: StreakState = {
			currentStreak: 5,
			shieldBank: 1,
			lastPlayedDate: '2026-03-22', // 2 days ago → 1 missed day
			longestStreak: 5
		};
		const result = recordDailyPlay(base, '2026-03-24');
		expect(result.currentStreak).toBe(6);
		expect(result.shieldBank).toBe(0);
	});

	it('uses multiple shields for multiple missed days', () => {
		const base: StreakState = {
			currentStreak: 5,
			shieldBank: 3,
			lastPlayedDate: '2026-03-21', // 3 days ago → 2 missed days
			longestStreak: 5
		};
		const result = recordDailyPlay(base, '2026-03-24');
		expect(result.currentStreak).toBe(6);
		expect(result.shieldBank).toBe(1); // 3 - 2 = 1
	});

	it('maintains longestStreak when streak continues via shield', () => {
		const base: StreakState = {
			currentStreak: 10,
			shieldBank: 2,
			lastPlayedDate: '2026-03-22',
			longestStreak: 10
		};
		const result = recordDailyPlay(base, '2026-03-24');
		expect(result.longestStreak).toBe(11);
	});
});

// ---------------------------------------------------------------------------
// recordDailyPlay — missed days without shields (streak break)
// ---------------------------------------------------------------------------

describe('recordDailyPlay — streak break', () => {
	it('resets streak to 1 when no shields available for missed day', () => {
		const base: StreakState = {
			currentStreak: 10,
			shieldBank: 0,
			lastPlayedDate: '2026-03-22', // 2 days ago → 1 missed day
			longestStreak: 10
		};
		const result = recordDailyPlay(base, '2026-03-24');
		expect(result.currentStreak).toBe(1);
	});

	it('resets streak when missed days exceed shield bank', () => {
		const base: StreakState = {
			currentStreak: 10,
			shieldBank: 1,
			lastPlayedDate: '2026-03-20', // 4 days ago → 3 missed days
			longestStreak: 10
		};
		const result = recordDailyPlay(base, '2026-03-24');
		expect(result.currentStreak).toBe(1);
	});

	it('preserves longestStreak on streak break', () => {
		const base: StreakState = {
			currentStreak: 10,
			shieldBank: 0,
			lastPlayedDate: '2026-03-22',
			longestStreak: 10
		};
		const result = recordDailyPlay(base, '2026-03-24');
		expect(result.longestStreak).toBe(10); // unchanged
	});

	it('does not award shields on streak break', () => {
		const base: StreakState = {
			currentStreak: 6,
			shieldBank: 0,
			lastPlayedDate: '2026-03-22',
			longestStreak: 6
		};
		// Would cross 7-day milestone if streak reached 7, but streak breaks instead
		const result = recordDailyPlay(base, '2026-03-24');
		expect(result.currentStreak).toBe(1);
		expect(result.shieldBank).toBe(0);
	});
});

// ---------------------------------------------------------------------------
// recordDailyPlay — shield awards at 7-day milestones
// ---------------------------------------------------------------------------

describe('recordDailyPlay — shield awards', () => {
	it('awards one shield when streak reaches 7', () => {
		const base: StreakState = {
			currentStreak: 6,
			shieldBank: 0,
			lastPlayedDate: '2026-03-23',
			longestStreak: 6
		};
		const result = recordDailyPlay(base, '2026-03-24');
		expect(result.currentStreak).toBe(7);
		expect(result.shieldBank).toBe(1);
	});

	it('awards another shield at 14-day streak', () => {
		const base: StreakState = {
			currentStreak: 13,
			shieldBank: 1,
			lastPlayedDate: '2026-03-23',
			longestStreak: 13
		};
		const result = recordDailyPlay(base, '2026-03-24');
		expect(result.currentStreak).toBe(14);
		expect(result.shieldBank).toBe(2);
	});

	it('caps shield bank at 3', () => {
		const base: StreakState = {
			currentStreak: 20,
			shieldBank: 3,
			lastPlayedDate: '2026-03-23',
			longestStreak: 20
		};
		const result = recordDailyPlay(base, '2026-03-24');
		// streak 21 = 3 * 7 milestone, but already capped at 3
		expect(result.shieldBank).toBe(3);
	});

	it('does not award shield for non-milestone streak values', () => {
		const base: StreakState = {
			currentStreak: 3,
			shieldBank: 0,
			lastPlayedDate: '2026-03-23',
			longestStreak: 3
		};
		const result = recordDailyPlay(base, '2026-03-24');
		expect(result.shieldBank).toBe(0);
	});

	it('awards shield at 7 even when recovering via shield from missed day', () => {
		// streak = 6, missed 1 day (uses 1 shield), streak reaches 7 → earns 1 shield back
		const base: StreakState = {
			currentStreak: 6,
			shieldBank: 1,
			lastPlayedDate: '2026-03-22', // 1 missed day
			longestStreak: 6
		};
		const result = recordDailyPlay(base, '2026-03-24');
		expect(result.currentStreak).toBe(7);
		expect(result.shieldBank).toBe(1); // used 1 for missed day, earned 1 for milestone
	});
});

// ---------------------------------------------------------------------------
// recordDailyPlay — does not mutate input
// ---------------------------------------------------------------------------

describe('recordDailyPlay — immutability', () => {
	it('does not mutate the input streak state', () => {
		const base: StreakState = {
			currentStreak: 5,
			shieldBank: 1,
			lastPlayedDate: '2026-03-23',
			longestStreak: 5
		};
		const frozen = Object.freeze({ ...base });
		const result = recordDailyPlay(frozen, '2026-03-24');
		expect(result).not.toBe(frozen);
		expect(result.currentStreak).toBe(6);
	});
});

// ---------------------------------------------------------------------------
// recordDailyPlay — past date (no-op)
// ---------------------------------------------------------------------------

describe('recordDailyPlay — past date', () => {
	it('ignores plays on dates before lastPlayedDate', () => {
		const base: StreakState = {
			currentStreak: 5,
			shieldBank: 0,
			lastPlayedDate: '2026-03-24',
			longestStreak: 5
		};
		const result = recordDailyPlay(base, '2026-03-20');
		expect(result).toBe(base);
	});
});

// ---------------------------------------------------------------------------
// saveStreakState / loadStreakState
// ---------------------------------------------------------------------------

describe('saveStreakState / loadStreakState', () => {
	it('saves and loads streak state round-trip', async () => {
		const state: StreakState = {
			currentStreak: 12,
			shieldBank: 2,
			lastPlayedDate: '2026-03-24',
			longestStreak: 20
		};
		await saveStreakState(state);
		const loaded = await loadStreakState();
		expect(loaded).toEqual(state);
	});

	it('returns default state when nothing is stored', async () => {
		const loaded = await loadStreakState();
		expect(loaded).toEqual(DEFAULT_STREAK_STATE);
	});

	it('saves to the correct IDB key', async () => {
		const { set } = await import('idb-keyval');
		const state: StreakState = { ...DEFAULT_STREAK_STATE, currentStreak: 5 };
		await saveStreakState(state);
		expect(set).toHaveBeenCalledWith(STREAK_STATE_KEY, state);
	});
});

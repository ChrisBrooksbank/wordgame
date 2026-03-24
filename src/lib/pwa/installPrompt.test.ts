import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
	loadInstallPromptState,
	saveInstallPromptState,
	incrementSessionCount,
	recordDailyForgeCompletion,
	dismissInstallPrompt,
	shouldShowInstallPrompt,
	isIOS,
	isStandalone,
	type InstallPromptState
} from './installPrompt.js';

// ---------------------------------------------------------------------------
// localStorage mock
// ---------------------------------------------------------------------------

const localStorageMock = (() => {
	let store: Record<string, string> = {};
	return {
		getItem: (key: string) => store[key] ?? null,
		setItem: (key: string, value: string) => {
			store[key] = value;
		},
		removeItem: (key: string) => {
			delete store[key];
		},
		clear: () => {
			store = {};
		}
	};
})();

vi.stubGlobal('localStorage', localStorageMock);

beforeEach(() => {
	localStorageMock.clear();
});

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('loadInstallPromptState', () => {
	it('returns default state when nothing stored', () => {
		const state = loadInstallPromptState();
		expect(state.sessionCount).toBe(0);
		expect(state.dailyForgeCompletions).toBe(0);
		expect(state.dismissedAt).toBeNull();
	});

	it('returns persisted state', () => {
		const s: InstallPromptState = { sessionCount: 2, dailyForgeCompletions: 1, dismissedAt: 12345 };
		saveInstallPromptState(s);
		expect(loadInstallPromptState()).toEqual(s);
	});

	it('handles malformed JSON gracefully', () => {
		localStorageMock.setItem('lexicon-forge:install-prompt', '{bad json');
		const state = loadInstallPromptState();
		expect(state.sessionCount).toBe(0);
	});
});

describe('incrementSessionCount', () => {
	it('starts at 0 and increments to 1', () => {
		const state = incrementSessionCount();
		expect(state.sessionCount).toBe(1);
	});

	it('increments across calls', () => {
		incrementSessionCount();
		incrementSessionCount();
		const state = incrementSessionCount();
		expect(state.sessionCount).toBe(3);
	});

	it('persists the new count', () => {
		incrementSessionCount();
		expect(loadInstallPromptState().sessionCount).toBe(1);
	});
});

describe('recordDailyForgeCompletion', () => {
	it('starts at 0 and increments to 1', () => {
		const state = recordDailyForgeCompletion();
		expect(state.dailyForgeCompletions).toBe(1);
	});

	it('increments across calls', () => {
		recordDailyForgeCompletion();
		const state = recordDailyForgeCompletion();
		expect(state.dailyForgeCompletions).toBe(2);
	});

	it('persists the new count', () => {
		recordDailyForgeCompletion();
		expect(loadInstallPromptState().dailyForgeCompletions).toBe(1);
	});
});

describe('dismissInstallPrompt', () => {
	it('sets dismissedAt to a recent timestamp', () => {
		const before = Date.now();
		const state = dismissInstallPrompt();
		const after = Date.now();
		expect(state.dismissedAt).not.toBeNull();
		expect(state.dismissedAt!).toBeGreaterThanOrEqual(before);
		expect(state.dismissedAt!).toBeLessThanOrEqual(after);
	});

	it('persists the dismissal', () => {
		dismissInstallPrompt();
		expect(loadInstallPromptState().dismissedAt).not.toBeNull();
	});
});

describe('shouldShowInstallPrompt', () => {
	const baseState: InstallPromptState = {
		sessionCount: 0,
		dailyForgeCompletions: 0,
		dismissedAt: null
	};

	it('returns false when thresholds not met', () => {
		expect(shouldShowInstallPrompt({ ...baseState, sessionCount: 2 })).toBe(false);
		expect(shouldShowInstallPrompt({ ...baseState, dailyForgeCompletions: 1 })).toBe(false);
	});

	it('returns true after 3rd session', () => {
		expect(shouldShowInstallPrompt({ ...baseState, sessionCount: 3 })).toBe(true);
		expect(shouldShowInstallPrompt({ ...baseState, sessionCount: 5 })).toBe(true);
	});

	it('returns true after 2nd Daily Forge completion', () => {
		expect(shouldShowInstallPrompt({ ...baseState, dailyForgeCompletions: 2 })).toBe(true);
		expect(shouldShowInstallPrompt({ ...baseState, dailyForgeCompletions: 3 })).toBe(true);
	});

	it('returns false during 7-day dismissal cooldown', () => {
		const dismissedAt = Date.now() - 3 * 24 * 60 * 60 * 1000; // 3 days ago
		const state: InstallPromptState = { sessionCount: 5, dailyForgeCompletions: 3, dismissedAt };
		expect(shouldShowInstallPrompt(state)).toBe(false);
	});

	it('returns true after 7-day cooldown expires', () => {
		const dismissedAt = Date.now() - 8 * 24 * 60 * 60 * 1000; // 8 days ago
		const state: InstallPromptState = { sessionCount: 5, dailyForgeCompletions: 3, dismissedAt };
		expect(shouldShowInstallPrompt(state)).toBe(true);
	});

	it('uses provided now parameter', () => {
		const dismissedAt = 1000;
		const state: InstallPromptState = { sessionCount: 5, dailyForgeCompletions: 0, dismissedAt };
		// 3 days after dismissal — still in cooldown
		const threeDaysLater = dismissedAt + 3 * 24 * 60 * 60 * 1000;
		expect(shouldShowInstallPrompt(state, threeDaysLater)).toBe(false);
		// 8 days after dismissal — cooldown expired
		const eightDaysLater = dismissedAt + 8 * 24 * 60 * 60 * 1000;
		expect(shouldShowInstallPrompt(state, eightDaysLater)).toBe(true);
	});
});

describe('isIOS', () => {
	it('returns false in node/vitest environment', () => {
		expect(isIOS()).toBe(false);
	});
});

describe('isStandalone', () => {
	it('returns false in node/vitest environment', () => {
		expect(isStandalone()).toBe(false);
	});
});

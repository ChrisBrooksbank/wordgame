/**
 * Custom install prompt logic.
 *
 * Shows after the 3rd session or 2nd Daily Forge completion.
 * Dismissed prompt won't re-show for 7 days.
 * Handles both Android (beforeinstallprompt) and iOS (manual instructions).
 */

const STORAGE_KEY = 'lexicon-forge:install-prompt';
const DISMISS_COOLDOWN_MS = 7 * 24 * 60 * 60 * 1000; // 7 days
const SESSION_THRESHOLD = 3;
const DAILY_FORGE_THRESHOLD = 2;

export interface InstallPromptState {
	sessionCount: number;
	dailyForgeCompletions: number;
	dismissedAt: number | null;
}

const DEFAULT_STATE: InstallPromptState = {
	sessionCount: 0,
	dailyForgeCompletions: 0,
	dismissedAt: null
};

/** Load state from localStorage. Returns default state in non-browser environments. */
export function loadInstallPromptState(): InstallPromptState {
	if (typeof localStorage === 'undefined') return { ...DEFAULT_STATE };
	try {
		const raw = localStorage.getItem(STORAGE_KEY);
		if (!raw) return { ...DEFAULT_STATE };
		return { ...DEFAULT_STATE, ...(JSON.parse(raw) as Partial<InstallPromptState>) };
	} catch {
		return { ...DEFAULT_STATE };
	}
}

/** Persist state to localStorage. No-op in non-browser environments. */
export function saveInstallPromptState(state: InstallPromptState): void {
	if (typeof localStorage === 'undefined') return;
	try {
		localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
	} catch {
		// Storage unavailable — ignore
	}
}

/** Increment session count and persist. Returns updated state. */
export function incrementSessionCount(): InstallPromptState {
	const state = loadInstallPromptState();
	const updated = { ...state, sessionCount: state.sessionCount + 1 };
	saveInstallPromptState(updated);
	return updated;
}

/** Record a Daily Forge completion and persist. Returns updated state. */
export function recordDailyForgeCompletion(): InstallPromptState {
	const state = loadInstallPromptState();
	const updated = {
		...state,
		dailyForgeCompletions: state.dailyForgeCompletions + 1
	};
	saveInstallPromptState(updated);
	return updated;
}

/** Mark the prompt as dismissed (now). Returns updated state. */
export function dismissInstallPrompt(): InstallPromptState {
	const state = loadInstallPromptState();
	const updated = { ...state, dismissedAt: Date.now() };
	saveInstallPromptState(updated);
	return updated;
}

/**
 * Decide whether to show the install prompt given current state and current time.
 * @param state - current install prompt state
 * @param now - current timestamp (default: Date.now())
 */
export function shouldShowInstallPrompt(
	state: InstallPromptState,
	now: number = Date.now()
): boolean {
	// Within 7-day dismissal cooldown
	if (state.dismissedAt !== null && now - state.dismissedAt < DISMISS_COOLDOWN_MS) {
		return false;
	}

	// Threshold met
	return (
		state.sessionCount >= SESSION_THRESHOLD || state.dailyForgeCompletions >= DAILY_FORGE_THRESHOLD
	);
}

/** Detect iOS (iPhone/iPad). iOS does not fire beforeinstallprompt. */
export function isIOS(): boolean {
	if (typeof navigator === 'undefined') return false;
	return /iphone|ipad|ipod/i.test(navigator.userAgent);
}

/** Detect if app is already running in standalone (installed) mode. */
export function isStandalone(): boolean {
	if (typeof window === 'undefined') return false;
	return (
		window.matchMedia('(display-mode: standalone)').matches ||
		('standalone' in navigator && (navigator as { standalone?: boolean }).standalone === true)
	);
}

/**
 * Personal best tracking for Rush Mode.
 *
 * Tracks: all-time high score, best combo streak (multiplier reached),
 * most words in a single game, and longest word found.
 */

import { get as idbGet, set as idbSet } from 'idb-keyval';

// -------------------------------------------------------------------------
// Types
// -------------------------------------------------------------------------

export interface RushPersonalBests {
	/** All-time highest score in a single Rush game. */
	highScore: number;
	/** Highest combo multiplier ever reached (1–5). */
	bestComboStreak: number;
	/** Most words found in a single Rush game. */
	mostWords: number;
	/** Longest word (by character count) ever found in Rush. */
	longestWord: string;
}

/** Which personal bests were broken in a given game. */
export interface BrokenBests {
	highScore: boolean;
	bestComboStreak: boolean;
	mostWords: boolean;
	longestWord: boolean;
}

// -------------------------------------------------------------------------
// Defaults
// -------------------------------------------------------------------------

export const DEFAULT_RUSH_PERSONAL_BESTS: RushPersonalBests = {
	highScore: 0,
	bestComboStreak: 1,
	mostWords: 0,
	longestWord: ''
};

// -------------------------------------------------------------------------
// IDB key
// -------------------------------------------------------------------------

export const RUSH_PERSONAL_BESTS_KEY = 'lexicon-forge:rush-personal-bests';

// -------------------------------------------------------------------------
// Core logic
// -------------------------------------------------------------------------

/**
 * Given the current personal bests and a completed game's stats, returns
 * the updated personal bests and a record of which ones were broken.
 *
 * A personal best is considered broken if the new value strictly exceeds
 * the previous value (or, for longestWord, strictly exceeds in length).
 */
export function updatePersonalBests(
	current: RushPersonalBests,
	gameScore: number,
	gameComboStreak: number,
	gameWordCount: number,
	gameLongestWord: string
): { updated: RushPersonalBests; broken: BrokenBests } {
	const broken: BrokenBests = {
		highScore: gameScore > current.highScore,
		bestComboStreak: gameComboStreak > current.bestComboStreak,
		mostWords: gameWordCount > current.mostWords,
		longestWord: gameLongestWord.length > current.longestWord.length
	};

	const updated: RushPersonalBests = {
		highScore: broken.highScore ? gameScore : current.highScore,
		bestComboStreak: broken.bestComboStreak ? gameComboStreak : current.bestComboStreak,
		mostWords: broken.mostWords ? gameWordCount : current.mostWords,
		longestWord: broken.longestWord ? gameLongestWord : current.longestWord
	};

	return { updated, broken };
}

/**
 * Returns true if any personal best was broken.
 */
export function anyBroken(broken: BrokenBests): boolean {
	return broken.highScore || broken.bestComboStreak || broken.mostWords || broken.longestWord;
}

/**
 * Derives the longest word from an array of found words.
 * Returns empty string if no words provided.
 */
export function longestWordFromList(words: string[]): string {
	if (words.length === 0) return '';
	return words.reduce((a, b) => (b.length > a.length ? b : a));
}

// -------------------------------------------------------------------------
// IndexedDB persistence
// -------------------------------------------------------------------------

/** Load personal bests from IndexedDB (returns defaults if absent). */
export async function loadPersonalBests(): Promise<RushPersonalBests> {
	const stored = await idbGet<RushPersonalBests>(RUSH_PERSONAL_BESTS_KEY);
	return stored ?? { ...DEFAULT_RUSH_PERSONAL_BESTS };
}

/** Persist personal bests to IndexedDB. */
export async function savePersonalBests(bests: RushPersonalBests): Promise<void> {
	await idbSet(RUSH_PERSONAL_BESTS_KEY, bests);
}

/**
 * Svelte stores + IndexedDB persistence for Lexicon Forge game state.
 *
 * Game state: current grid, active path, running score, words found this session.
 * Player stats: lifetime totals tracked across sessions.
 */

import { writable } from 'svelte/store';
import { get as idbGet, set as idbSet } from 'idb-keyval';
import type { HexGrid, HexCoord } from '../engine/hexGrid.js';

// -----------------------------------------------------------------------
// Types
// -----------------------------------------------------------------------

export interface GameState {
	grid: HexGrid | null;
	path: HexCoord[];
	score: number;
	wordsFound: string[];
}

export interface PlayerStats {
	gamesPlayed: number;
	totalScore: number;
	bestWords: { word: string; score: number }[];
}

// -----------------------------------------------------------------------
// IDB keys
// -----------------------------------------------------------------------

export const GAME_STATE_KEY = 'lexicon-forge:game-state';
export const PLAYER_STATS_KEY = 'lexicon-forge:player-stats';

// -----------------------------------------------------------------------
// Defaults
// -----------------------------------------------------------------------

export const DEFAULT_GAME_STATE: GameState = {
	grid: null,
	path: [],
	score: 0,
	wordsFound: []
};

export const DEFAULT_PLAYER_STATS: PlayerStats = {
	gamesPlayed: 0,
	totalScore: 0,
	bestWords: []
};

// -----------------------------------------------------------------------
// Stores
// -----------------------------------------------------------------------

export const gameState = writable<GameState>(DEFAULT_GAME_STATE);
export const playerStats = writable<PlayerStats>(DEFAULT_PLAYER_STATS);

// -----------------------------------------------------------------------
// Persistence helpers
// -----------------------------------------------------------------------

/** Persist game state to IndexedDB. */
export async function saveGameState(state: GameState): Promise<void> {
	await idbSet(GAME_STATE_KEY, state);
}

/** Load game state from IndexedDB (returns default if absent). */
export async function loadGameState(): Promise<GameState> {
	const stored = await idbGet<GameState>(GAME_STATE_KEY);
	return stored ?? DEFAULT_GAME_STATE;
}

/** Persist player stats to IndexedDB. */
export async function savePlayerStats(stats: PlayerStats): Promise<void> {
	await idbSet(PLAYER_STATS_KEY, stats);
}

/** Load player stats from IndexedDB (returns default if absent). */
export async function loadPlayerStats(): Promise<PlayerStats> {
	const stored = await idbGet<PlayerStats>(PLAYER_STATS_KEY);
	return stored ?? DEFAULT_PLAYER_STATS;
}

// -----------------------------------------------------------------------
// Initialisation
// -----------------------------------------------------------------------

/**
 * Hydrate stores from IndexedDB. Call once on app start.
 * On error (e.g. first visit, storage unavailable) stores stay at defaults.
 */
export async function initStores(): Promise<void> {
	try {
		const [state, stats] = await Promise.all([loadGameState(), loadPlayerStats()]);
		gameState.set(state);
		playerStats.set(stats);
	} catch {
		// Storage unavailable — continue with defaults
	}
}

// -----------------------------------------------------------------------
// Helpers for updating stats after a game
// -----------------------------------------------------------------------

/**
 * Record a completed game: increment games played, add to total score,
 * and update bestWords (top 10 by score, deduplicated by word).
 */
export function recordGame(
	stats: PlayerStats,
	scoreEarned: number,
	words: { word: string; score: number }[]
): PlayerStats {
	const merged = [...stats.bestWords, ...words];
	// Deduplicate keeping highest score per word
	const best = new Map<string, { word: string; score: number }>();
	for (const entry of merged) {
		const existing = best.get(entry.word);
		if (!existing || entry.score > existing.score) {
			best.set(entry.word, entry);
		}
	}
	const bestWords = Array.from(best.values())
		.sort((a, b) => b.score - a.score)
		.slice(0, 10);

	return {
		gamesPlayed: stats.gamesPlayed + 1,
		totalScore: stats.totalScore + scoreEarned,
		bestWords
	};
}

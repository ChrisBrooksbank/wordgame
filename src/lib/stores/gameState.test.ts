import { describe, it, expect, vi, beforeEach } from 'vitest';
import { get } from 'svelte/store';

// Mock idb-keyval before importing the store module
const mockStore = new Map<string, unknown>();

vi.mock('idb-keyval', () => ({
	get: vi.fn(async (key: string) => mockStore.get(key)),
	set: vi.fn(async (key: string, value: unknown) => {
		mockStore.set(key, value);
	})
}));

import {
	gameState,
	playerStats,
	saveGameState,
	loadGameState,
	savePlayerStats,
	loadPlayerStats,
	initStores,
	recordGame,
	DEFAULT_GAME_STATE,
	DEFAULT_PLAYER_STATS,
	GAME_STATE_KEY,
	PLAYER_STATS_KEY
} from './gameState.js';
import type { GameState, PlayerStats } from './gameState.js';

beforeEach(() => {
	mockStore.clear();
	// Reset stores to defaults before each test
	gameState.set(DEFAULT_GAME_STATE);
	playerStats.set(DEFAULT_PLAYER_STATS);
});

describe('saveGameState / loadGameState', () => {
	it('saves and loads game state round-trip', async () => {
		const state: GameState = {
			grid: null,
			path: [
				{ q: 0, r: 0 },
				{ q: 1, r: 0 }
			],
			score: 42,
			wordsFound: ['CAT', 'DOG']
		};
		await saveGameState(state);
		const loaded = await loadGameState();
		expect(loaded).toEqual(state);
	});

	it('returns default game state when nothing is stored', async () => {
		const loaded = await loadGameState();
		expect(loaded).toEqual(DEFAULT_GAME_STATE);
	});

	it('saves to the correct IDB key', async () => {
		const { set } = await import('idb-keyval');
		const state: GameState = { ...DEFAULT_GAME_STATE, score: 99 };
		await saveGameState(state);
		expect(set).toHaveBeenCalledWith(GAME_STATE_KEY, state);
	});
});

describe('savePlayerStats / loadPlayerStats', () => {
	it('saves and loads player stats round-trip', async () => {
		const stats: PlayerStats = {
			gamesPlayed: 5,
			totalScore: 500,
			bestWords: [{ word: 'QUARTZ', score: 200 }]
		};
		await savePlayerStats(stats);
		const loaded = await loadPlayerStats();
		expect(loaded).toEqual(stats);
	});

	it('returns default player stats when nothing is stored', async () => {
		const loaded = await loadPlayerStats();
		expect(loaded).toEqual(DEFAULT_PLAYER_STATS);
	});

	it('saves to the correct IDB key', async () => {
		const { set } = await import('idb-keyval');
		const stats: PlayerStats = { ...DEFAULT_PLAYER_STATS, gamesPlayed: 3 };
		await savePlayerStats(stats);
		expect(set).toHaveBeenCalledWith(PLAYER_STATS_KEY, stats);
	});
});

describe('initStores', () => {
	it('hydrates gameState store from IndexedDB', async () => {
		const stored: GameState = { ...DEFAULT_GAME_STATE, score: 77, wordsFound: ['FORGE'] };
		mockStore.set(GAME_STATE_KEY, stored);
		await initStores();
		expect(get(gameState)).toEqual(stored);
	});

	it('hydrates playerStats store from IndexedDB', async () => {
		const stored: PlayerStats = {
			gamesPlayed: 10,
			totalScore: 1000,
			bestWords: [{ word: 'BLAZE', score: 50 }]
		};
		mockStore.set(PLAYER_STATS_KEY, stored);
		await initStores();
		expect(get(playerStats)).toEqual(stored);
	});

	it('uses defaults when IndexedDB is empty', async () => {
		await initStores();
		expect(get(gameState)).toEqual(DEFAULT_GAME_STATE);
		expect(get(playerStats)).toEqual(DEFAULT_PLAYER_STATS);
	});

	it('does not throw when storage fails', async () => {
		const { get: idbGet } = await import('idb-keyval');
		vi.mocked(idbGet).mockRejectedValueOnce(new Error('storage unavailable'));
		await expect(initStores()).resolves.not.toThrow();
	});
});

describe('recordGame', () => {
	it('increments gamesPlayed', () => {
		const stats = recordGame(DEFAULT_PLAYER_STATS, 100, []);
		expect(stats.gamesPlayed).toBe(1);
	});

	it('adds score to totalScore', () => {
		const base: PlayerStats = { ...DEFAULT_PLAYER_STATS, totalScore: 200 };
		const stats = recordGame(base, 50, []);
		expect(stats.totalScore).toBe(250);
	});

	it('accumulates bestWords across games', () => {
		const words = [
			{ word: 'CAT', score: 9 },
			{ word: 'FORGE', score: 25 }
		];
		const stats = recordGame(DEFAULT_PLAYER_STATS, 34, words);
		expect(stats.bestWords).toHaveLength(2);
		expect(stats.bestWords[0].word).toBe('FORGE'); // sorted by score desc
	});

	it('deduplicates words keeping highest score', () => {
		const existing: PlayerStats = {
			...DEFAULT_PLAYER_STATS,
			bestWords: [{ word: 'CAT', score: 9 }]
		};
		// Same word 'CAT' with higher score
		const stats = recordGame(existing, 18, [{ word: 'CAT', score: 18 }]);
		const catEntry = stats.bestWords.find((w) => w.word === 'CAT');
		expect(catEntry?.score).toBe(18);
		expect(stats.bestWords.filter((w) => w.word === 'CAT')).toHaveLength(1);
	});

	it('keeps at most 10 best words', () => {
		const many = Array.from({ length: 15 }, (_, i) => ({ word: `WORD${i}`, score: i + 1 }));
		const stats = recordGame(DEFAULT_PLAYER_STATS, 100, many);
		expect(stats.bestWords).toHaveLength(10);
		// Should keep highest scores
		expect(stats.bestWords[0].score).toBe(15);
	});

	it('does not mutate the input stats', () => {
		const original: PlayerStats = { ...DEFAULT_PLAYER_STATS };
		recordGame(original, 100, [{ word: 'TEST', score: 16 }]);
		expect(original.gamesPlayed).toBe(0);
		expect(original.bestWords).toHaveLength(0);
	});
});

describe('stores reactive state', () => {
	it('gameState store updates reactively', () => {
		const updated: GameState = { ...DEFAULT_GAME_STATE, score: 123 };
		gameState.set(updated);
		expect(get(gameState).score).toBe(123);
	});

	it('playerStats store updates reactively', () => {
		const updated: PlayerStats = { ...DEFAULT_PLAYER_STATS, gamesPlayed: 7 };
		playerStats.set(updated);
		expect(get(playerStats).gamesPlayed).toBe(7);
	});
});

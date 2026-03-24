/**
 * Achievement system for Lexicon Forge.
 *
 * Achievements are organised by cognitive dimension and unlocked when
 * cumulative stats meet defined criteria.  Hidden achievements show as
 * "???" until unlocked.
 */

import { get as idbGet, set as idbSet } from 'idb-keyval';
import type { CognitiveDimension } from './cognitiveRating.js';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface AchievementDef {
	id: string;
	name: string;
	description: string;
	category: CognitiveDimension;
	/** If true the name/description displays as ??? until unlocked. */
	hidden: boolean;
	emoji: string;
}

/** Player's persistent record for a single achievement. */
export interface AchievementRecord {
	id: string;
	/** ISO date string when the achievement was unlocked, or null if still locked. */
	unlockedAt: string | null;
}

/**
 * Cumulative statistics used to evaluate achievement criteria.
 * Updated incrementally as the player completes games.
 */
export interface AchievementStats {
	/** Unique words of 6+ letters ever found (lower-cased, deduplicated). */
	uniqueLongWords: string[];
	/** Highest Rush combo multiplier ever reached (1–5). */
	maxComboEver: number;
	/** Longest Cascade chain ever achieved (number of chained auto-forges). */
	longestCascadeChainEver: number;
	/** True once the player completes a Memory Crucible round with ≤2 s view time. */
	crucibleWithTwoSecondView: boolean;
	/** Highest star rating (1–5) ever achieved on Daily Forge. */
	maxDailyForgeStars: number;
}

export interface AchievementStore {
	/** Per-achievement unlock records, keyed by achievement ID. */
	records: Record<string, AchievementRecord>;
	stats: AchievementStats;
}

// ---------------------------------------------------------------------------
// Achievement definitions
// ---------------------------------------------------------------------------

export const ACHIEVEMENT_DEFS: AchievementDef[] = [
	// ── Vocabulary Depth ────────────────────────────────────────────────────
	{
		id: 'vocab_word_collector',
		name: 'Word Collector',
		description: 'Find 10 unique words with 6 or more letters.',
		category: 'vocabularyDepth',
		hidden: false,
		emoji: '📖'
	},
	{
		id: 'vocab_lexicographer',
		name: 'Lexicographer',
		description: 'Find 100 unique words with 6 or more letters.',
		category: 'vocabularyDepth',
		hidden: false,
		emoji: '📚'
	},
	// ── Processing Speed ────────────────────────────────────────────────────
	{
		id: 'speed_hot_streak',
		name: 'Hot Streak',
		description: 'Reach a 4× combo multiplier in Rush mode.',
		category: 'processingSpeed',
		hidden: true,
		emoji: '🔥'
	},
	{
		id: 'speed_lightning_fingers',
		name: 'Lightning Fingers',
		description: 'Reach a 5× combo multiplier in Rush mode.',
		category: 'processingSpeed',
		hidden: false,
		emoji: '⚡'
	},
	// ── Pattern Recognition ─────────────────────────────────────────────────
	{
		id: 'pattern_cascade_novice',
		name: 'Cascade Novice',
		description: 'Trigger a 2-chain reaction in Cascade mode.',
		category: 'patternRecognition',
		hidden: true,
		emoji: '🔗'
	},
	{
		id: 'pattern_chain_master',
		name: 'Chain Master',
		description: 'Trigger a cascade chain of 4 or more in Cascade mode.',
		category: 'patternRecognition',
		hidden: false,
		emoji: '🌊'
	},
	// ── Working Memory ──────────────────────────────────────────────────────
	{
		id: 'memory_photographic',
		name: 'Photographic',
		description: 'Complete a Memory Crucible round with only 2 seconds to view the board.',
		category: 'workingMemory',
		hidden: false,
		emoji: '📸'
	},
	// ── Strategic Thinking ──────────────────────────────────────────────────
	{
		id: 'strategy_three_stars',
		name: 'Star Forger',
		description: 'Earn 3 stars on a Daily Forge puzzle.',
		category: 'strategicThinking',
		hidden: true,
		emoji: '⭐'
	},
	{
		id: 'strategy_perfect_forge',
		name: 'Perfect Forge',
		description: 'Earn 5 stars on a Daily Forge puzzle.',
		category: 'strategicThinking',
		hidden: false,
		emoji: '🌟'
	}
];

// ---------------------------------------------------------------------------
// Defaults & IDB key
// ---------------------------------------------------------------------------

export const DEFAULT_ACHIEVEMENT_STATS: AchievementStats = {
	uniqueLongWords: [],
	maxComboEver: 0,
	longestCascadeChainEver: 0,
	crucibleWithTwoSecondView: false,
	maxDailyForgeStars: 0
};

export const ACHIEVEMENT_IDB_KEY = 'lexicon-forge:achievements';

export function defaultAchievementStore(): AchievementStore {
	return {
		records: {},
		stats: { ...DEFAULT_ACHIEVEMENT_STATS, uniqueLongWords: [] }
	};
}

// ---------------------------------------------------------------------------
// Unlock criteria check
// ---------------------------------------------------------------------------

function isCriteriaMet(id: string, stats: AchievementStats): boolean {
	switch (id) {
		case 'vocab_word_collector':
			return stats.uniqueLongWords.length >= 10;
		case 'vocab_lexicographer':
			return stats.uniqueLongWords.length >= 100;
		case 'speed_hot_streak':
			return stats.maxComboEver >= 4;
		case 'speed_lightning_fingers':
			return stats.maxComboEver >= 5;
		case 'pattern_cascade_novice':
			return stats.longestCascadeChainEver >= 2;
		case 'pattern_chain_master':
			return stats.longestCascadeChainEver >= 4;
		case 'memory_photographic':
			return stats.crucibleWithTwoSecondView;
		case 'strategy_three_stars':
			return stats.maxDailyForgeStars >= 3;
		case 'strategy_perfect_forge':
			return stats.maxDailyForgeStars >= 5;
		default:
			return false;
	}
}

/**
 * Returns all achievement IDs whose criteria are currently satisfied by `stats`.
 */
export function evaluateAchievements(stats: AchievementStats): string[] {
	return ACHIEVEMENT_DEFS.filter((def) => isCriteriaMet(def.id, stats)).map((def) => def.id);
}

// ---------------------------------------------------------------------------
// Stats update helpers — game event types
// ---------------------------------------------------------------------------

export interface VocabularyEvent {
	type: 'vocabulary';
	/** All valid words submitted during the game (filtering to 6+ is done here). */
	wordsFound: string[];
}

export interface SpeedEvent {
	type: 'speed';
	/** Highest combo multiplier reached during the game. */
	maxCombo: number;
}

export interface PatternEvent {
	type: 'pattern';
	/** Longest cascade chain achieved during the game. */
	cascadeChain: number;
}

export interface MemoryEvent {
	type: 'memory';
	/** The view-time in seconds that was active when the round was completed. */
	viewTimeSeconds: number;
	/** Whether the round was completed successfully (not a game-over). */
	roundCompleted: boolean;
}

export interface StrategyEvent {
	type: 'strategy';
	/** Star rating (1–5) earned at end of game. */
	starsEarned: number;
}

export type AchievementEvent =
	| VocabularyEvent
	| SpeedEvent
	| PatternEvent
	| MemoryEvent
	| StrategyEvent;

/**
 * Returns an updated `AchievementStats` after applying a game event.
 * Does not mutate the input object.
 */
export function updateStats(stats: AchievementStats, event: AchievementEvent): AchievementStats {
	switch (event.type) {
		case 'vocabulary': {
			const existing = new Set(stats.uniqueLongWords);
			for (const word of event.wordsFound) {
				if (word.length >= 6) existing.add(word.toLowerCase());
			}
			return { ...stats, uniqueLongWords: Array.from(existing) };
		}
		case 'speed':
			return { ...stats, maxComboEver: Math.max(stats.maxComboEver, event.maxCombo) };
		case 'pattern':
			return {
				...stats,
				longestCascadeChainEver: Math.max(stats.longestCascadeChainEver, event.cascadeChain)
			};
		case 'memory': {
			const unlocked =
				stats.crucibleWithTwoSecondView || (event.roundCompleted && event.viewTimeSeconds <= 2);
			return { ...stats, crucibleWithTwoSecondView: unlocked };
		}
		case 'strategy':
			return {
				...stats,
				maxDailyForgeStars: Math.max(stats.maxDailyForgeStars, event.starsEarned)
			};
	}
}

// ---------------------------------------------------------------------------
// Store mutation
// ---------------------------------------------------------------------------

/**
 * Applies updated stats to the store, unlocking any newly met achievements.
 *
 * @returns the updated store and an array of achievement IDs that were
 *          unlocked for the first time in this call.
 */
export function applyStatsUpdate(
	store: AchievementStore,
	newStats: AchievementStats,
	isoDate: string
): { store: AchievementStore; newlyUnlocked: string[] } {
	const nowMet = evaluateAchievements(newStats);
	const newlyUnlocked: string[] = [];
	const updatedRecords: Record<string, AchievementRecord> = { ...store.records };

	for (const id of nowMet) {
		if (!updatedRecords[id]?.unlockedAt) {
			newlyUnlocked.push(id);
			updatedRecords[id] = { id, unlockedAt: isoDate };
		}
	}

	return {
		store: { records: updatedRecords, stats: newStats },
		newlyUnlocked
	};
}

// ---------------------------------------------------------------------------
// Display helpers
// ---------------------------------------------------------------------------

/**
 * Returns the record for the given achievement ID, defaulting to locked.
 */
export function getRecord(store: AchievementStore, id: string): AchievementRecord {
	return store.records[id] ?? { id, unlockedAt: null };
}

/**
 * Returns display-safe name, description, and emoji for an achievement,
 * masking hidden achievements that have not yet been unlocked.
 */
export function resolveAchievementDisplay(
	def: AchievementDef,
	record: AchievementRecord
): { name: string; description: string; emoji: string } {
	if (def.hidden && !record.unlockedAt) {
		return { name: '???', description: 'Keep playing to discover this achievement.', emoji: '🔒' };
	}
	return { name: def.name, description: def.description, emoji: def.emoji };
}

/**
 * Returns a fraction (0–1) representing how close the player is to unlocking
 * an achievement.  Returns 1 if already unlocked.
 */
export function achievementProgress(id: string, stats: AchievementStats): number {
	if (isCriteriaMet(id, stats)) return 1;
	switch (id) {
		case 'vocab_word_collector':
			return Math.min(stats.uniqueLongWords.length / 10, 1);
		case 'vocab_lexicographer':
			return Math.min(stats.uniqueLongWords.length / 100, 1);
		case 'speed_hot_streak':
			return Math.min(stats.maxComboEver / 4, 1);
		case 'speed_lightning_fingers':
			return Math.min(stats.maxComboEver / 5, 1);
		case 'pattern_cascade_novice':
			return Math.min(stats.longestCascadeChainEver / 2, 1);
		case 'pattern_chain_master':
			return Math.min(stats.longestCascadeChainEver / 4, 1);
		case 'memory_photographic':
			return stats.crucibleWithTwoSecondView ? 1 : 0;
		case 'strategy_three_stars':
			return Math.min(stats.maxDailyForgeStars / 3, 1);
		case 'strategy_perfect_forge':
			return Math.min(stats.maxDailyForgeStars / 5, 1);
		default:
			return 0;
	}
}

// ---------------------------------------------------------------------------
// IndexedDB persistence
// ---------------------------------------------------------------------------

/** Load the achievement store from IndexedDB; returns defaults if absent. */
export async function loadAchievementStore(): Promise<AchievementStore> {
	const stored = await idbGet<AchievementStore>(ACHIEVEMENT_IDB_KEY);
	return stored ?? defaultAchievementStore();
}

/** Persist the achievement store to IndexedDB. */
export async function saveAchievementStore(store: AchievementStore): Promise<void> {
	await idbSet(ACHIEVEMENT_IDB_KEY, store);
}

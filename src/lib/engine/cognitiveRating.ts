/**
 * 5-axis ELO-like cognitive rating system for Lexicon Forge.
 *
 * Dimensions:
 *   1. Vocabulary Depth      — unique words, rarity, word length
 *   2. Processing Speed      — Rush WPM, time-per-word, combo consistency
 *   3. Pattern Recognition   — cascade chains, cross-mode consistency
 *   4. Working Memory        — Memory Crucible rounds survived and accuracy
 *   5. Strategic Thinking    — star ratings, par performance, move efficiency
 *
 * Rating mechanics:
 *   - Starts at 1000 per dimension
 *   - K-factor: 32 (1–10 games), 16 (11–20 games), 8 (21+ games)
 *   - Update: newRating = oldRating + K * (actual – 0.5)
 *     where `actual` is a normalised performance score in [0, 1]
 *   - Ratings are clamped to [100, 3000]
 */

import { get as idbGet, set as idbSet } from 'idb-keyval';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type CognitiveDimension =
	| 'vocabularyDepth'
	| 'processingSpeed'
	| 'patternRecognition'
	| 'workingMemory'
	| 'strategicThinking';

export const COGNITIVE_DIMENSIONS: CognitiveDimension[] = [
	'vocabularyDepth',
	'processingSpeed',
	'patternRecognition',
	'workingMemory',
	'strategicThinking'
];

export interface DimensionRating {
	/** ELO-like rating value. Starts at 1000. */
	rating: number;
	/** Total games that have updated this dimension. Used for K-factor. */
	gamesPlayed: number;
	/** ISO date string of the last update. */
	lastUpdated: string;
}

export interface CognitiveProfile {
	vocabularyDepth: DimensionRating;
	processingSpeed: DimensionRating;
	patternRecognition: DimensionRating;
	workingMemory: DimensionRating;
	strategicThinking: DimensionRating;
}

/** A point-in-time snapshot stored once per calendar week. */
export interface WeeklySnapshot {
	/** ISO week-start date string (Monday, YYYY-MM-DD). */
	weekStart: string;
	ratings: Record<CognitiveDimension, number>;
}

export interface CognitiveProfileStore {
	profile: CognitiveProfile;
	/** Ordered list of weekly snapshots (oldest first, max ~8 entries = ~2 months). */
	snapshots: WeeklySnapshot[];
}

// ---------------------------------------------------------------------------
// Input shapes for each dimension
// ---------------------------------------------------------------------------

export interface VocabularyDepthInput {
	/** Number of distinct valid words submitted in the game. */
	uniqueWordCount: number;
	/** Average rarity multiplier of submitted words (1–5 scale). */
	avgRarityMultiplier: number;
	/** Average letter count of submitted words. */
	avgWordLength: number;
}

export interface ProcessingSpeedInput {
	/** Words found per minute. */
	wordsPerMinute: number;
	/** Average seconds taken per word submission. */
	avgSecondsPerWord: number;
	/** Combo consistency: fraction of submissions that maintained an active combo (0–1). */
	comboConsistency: number;
}

export interface PatternRecognitionInput {
	/** Longest cascade chain achieved (0 = no cascades). */
	longestChain: number;
	/** Fraction of board potential utilised across novel tiles (0–1). */
	novelBoardUtilisation: number;
}

export interface WorkingMemoryInput {
	/** Number of Memory Crucible rounds survived before game over. */
	roundsSurvived: number;
	/** Accuracy: fraction of correctly placed tiles (0–1). */
	accuracy: number;
}

export interface StrategicThinkingInput {
	/** Star rating achieved in the completed game (1–5). */
	starRating: number;
	/** Ratio of actual moves used vs par (1.0 = exactly on par; lower is better). */
	moveEfficiencyRatio: number;
}

// ---------------------------------------------------------------------------
// Defaults & IDB key
// ---------------------------------------------------------------------------

const DEFAULT_DIMENSION: DimensionRating = {
	rating: 1000,
	gamesPlayed: 0,
	lastUpdated: ''
};

export const DEFAULT_COGNITIVE_PROFILE: CognitiveProfile = {
	vocabularyDepth: { ...DEFAULT_DIMENSION },
	processingSpeed: { ...DEFAULT_DIMENSION },
	patternRecognition: { ...DEFAULT_DIMENSION },
	workingMemory: { ...DEFAULT_DIMENSION },
	strategicThinking: { ...DEFAULT_DIMENSION }
};

export const COGNITIVE_PROFILE_IDB_KEY = 'lexicon-forge:cognitive-profile';

// ---------------------------------------------------------------------------
// ELO mechanics
// ---------------------------------------------------------------------------

/**
 * Returns the K-factor for the given number of games played on a dimension.
 *
 * | Games played | K  |
 * |-------------|----|
 * | 1–10        | 32 |
 * | 11–20       | 16 |
 * | 21+         |  8 |
 */
export function kFactor(gamesPlayed: number): number {
	if (gamesPlayed <= 10) return 32;
	if (gamesPlayed <= 20) return 16;
	return 8;
}

/**
 * Applies a single ELO update to a dimension.
 *
 * @param dim   - current dimension state
 * @param performance - normalised performance score in [0, 1] (0.5 = neutral)
 * @param isoDate - ISO date string for `lastUpdated`
 * @returns the updated DimensionRating (immutable; does not mutate input)
 */
export function applyEloUpdate(
	dim: DimensionRating,
	performance: number,
	isoDate: string
): DimensionRating {
	const clampedPerformance = Math.max(0, Math.min(1, performance));
	const k = kFactor(dim.gamesPlayed + 1);
	const delta = k * (clampedPerformance - 0.5);
	const newRating = Math.max(100, Math.min(3000, Math.round(dim.rating + delta)));
	return {
		rating: newRating,
		gamesPlayed: dim.gamesPlayed + 1,
		lastUpdated: isoDate
	};
}

// ---------------------------------------------------------------------------
// Per-dimension performance normalisers
// ---------------------------------------------------------------------------

/**
 * Normalises Vocabulary Depth inputs to a [0, 1] performance score.
 *
 * Reference targets (score ≈ 0.75):
 *   - 10 unique words, avg rarity 2.5, avg length 5.0
 */
export function vocabularyDepthPerformance(input: VocabularyDepthInput): number {
	const wordScore = Math.min(input.uniqueWordCount / 15, 1); // 15+ unique words → 1.0
	const rarityScore = Math.min((input.avgRarityMultiplier - 1) / 4, 1); // rarity 5 → 1.0
	const lengthScore = Math.min((input.avgWordLength - 3) / 5, 1); // avg length 8 → 1.0
	return (wordScore + rarityScore + lengthScore) / 3;
}

/**
 * Normalises Processing Speed inputs to a [0, 1] performance score.
 *
 * Reference targets:
 *   - 2 WPM = 0.5 baseline for Rush (90 s, ~6 words typical)
 *   - Avg 10 s/word = neutral; < 5 s is fast
 *   - comboConsistency is already [0, 1]
 */
export function processingSpeedPerformance(input: ProcessingSpeedInput): number {
	const wpmScore = Math.min(input.wordsPerMinute / 4, 1); // 4 WPM → 1.0
	const timeScore = Math.max(0, Math.min(1, 1 - (input.avgSecondsPerWord - 3) / 17)); // 3 s → 1.0, 20 s → 0
	const comboScore = Math.max(0, Math.min(1, input.comboConsistency));
	return (wpmScore + timeScore + comboScore) / 3;
}

/**
 * Normalises Pattern Recognition inputs to a [0, 1] performance score.
 *
 * Reference targets:
 *   - Chain of 4+ = excellent (score ~1.0)
 *   - novelBoardUtilisation is already [0, 1]
 */
export function patternRecognitionPerformance(input: PatternRecognitionInput): number {
	const chainScore = Math.min(input.longestChain / 4, 1); // chain 4 → 1.0
	const utilisationScore = Math.max(0, Math.min(1, input.novelBoardUtilisation));
	return (chainScore + utilisationScore) / 2;
}

/**
 * Normalises Working Memory inputs to a [0, 1] performance score.
 *
 * Reference targets:
 *   - 5 rounds survived = excellent
 *   - accuracy is already [0, 1]
 */
export function workingMemoryPerformance(input: WorkingMemoryInput): number {
	const roundScore = Math.min(input.roundsSurvived / 5, 1); // 5 rounds → 1.0
	const accuracyScore = Math.max(0, Math.min(1, input.accuracy));
	return (roundScore + accuracyScore) / 2;
}

/**
 * Normalises Strategic Thinking inputs to a [0, 1] performance score.
 *
 * Reference targets:
 *   - 5 stars = 1.0, 1 star ≈ 0
 *   - moveEfficiencyRatio: 1.0 = on par (neutral ~0.5), < 1.0 = efficient (good)
 */
export function strategicThinkingPerformance(input: StrategicThinkingInput): number {
	const starScore = Math.max(0, (input.starRating - 1) / 4); // 1→0, 5→1
	// ratio 0.5 (half the moves) = 1.0; ratio 1.5 (50% over par) = 0
	const efficiencyScore = Math.max(0, Math.min(1, 1 - (input.moveEfficiencyRatio - 0.5)));
	return (starScore + efficiencyScore) / 2;
}

// ---------------------------------------------------------------------------
// Profile update helpers
// ---------------------------------------------------------------------------

/**
 * Updates a specific dimension within a CognitiveProfile, returning a new profile.
 */
export function updateProfileDimension(
	profile: CognitiveProfile,
	dimension: CognitiveDimension,
	performance: number,
	isoDate: string
): CognitiveProfile {
	return {
		...profile,
		[dimension]: applyEloUpdate(profile[dimension], performance, isoDate)
	};
}

/**
 * Computes the composite score: the arithmetic mean of all 5 dimension ratings.
 * Used for Forge Rank calculation.
 */
export function compositeScore(profile: CognitiveProfile): number {
	const ratings = COGNITIVE_DIMENSIONS.map((d) => profile[d].rating);
	return Math.round(ratings.reduce((a, b) => a + b, 0) / ratings.length);
}

// ---------------------------------------------------------------------------
// Weekly snapshots
// ---------------------------------------------------------------------------

/**
 * Returns the ISO date string (YYYY-MM-DD) for the Monday of the week
 * that contains the given date.
 */
export function weekStart(isoDate: string): string {
	const d = new Date(isoDate);
	const day = d.getUTCDay(); // 0 = Sunday
	const diff = day === 0 ? -6 : 1 - day; // shift to Monday
	const monday = new Date(d);
	monday.setUTCDate(d.getUTCDate() + diff);
	return monday.toISOString().slice(0, 10);
}

/**
 * Adds or updates a weekly snapshot for the given date, then prunes snapshots
 * older than ~8 weeks (56 days), keeping the list ordered oldest-first.
 *
 * Returns the updated snapshots array (does not mutate input).
 */
export function upsertWeeklySnapshot(
	snapshots: WeeklySnapshot[],
	profile: CognitiveProfile,
	isoDate: string
): WeeklySnapshot[] {
	const ws = weekStart(isoDate);
	const snapshot: WeeklySnapshot = {
		weekStart: ws,
		ratings: {
			vocabularyDepth: profile.vocabularyDepth.rating,
			processingSpeed: profile.processingSpeed.rating,
			patternRecognition: profile.patternRecognition.rating,
			workingMemory: profile.workingMemory.rating,
			strategicThinking: profile.strategicThinking.rating
		}
	};

	// Replace existing entry for the same week, or append
	const existing = snapshots.findIndex((s) => s.weekStart === ws);
	const updated =
		existing >= 0
			? [...snapshots.slice(0, existing), snapshot, ...snapshots.slice(existing + 1)]
			: [...snapshots, snapshot];

	// Prune entries older than 56 days
	const cutoff = new Date(isoDate);
	cutoff.setUTCDate(cutoff.getUTCDate() - 56);
	const cutoffStr = cutoff.toISOString().slice(0, 10);
	return updated.filter((s) => s.weekStart >= cutoffStr);
}

/**
 * Retrieves trend data for a single dimension: an array of { date, rating } pairs
 * from the snapshots array, ordered chronologically.
 */
export function dimensionTrend(
	snapshots: WeeklySnapshot[],
	dimension: CognitiveDimension
): Array<{ weekStart: string; rating: number }> {
	return snapshots.map((s) => ({ weekStart: s.weekStart, rating: s.ratings[dimension] }));
}

// ---------------------------------------------------------------------------
// IndexedDB persistence
// ---------------------------------------------------------------------------

/**
 * Returns the weekly snapshot with `weekStart` nearest to `targetDate`.
 * Returns null if `snapshots` is empty.
 */
export function getSnapshotNearDate(
	snapshots: WeeklySnapshot[],
	targetDate: string
): WeeklySnapshot | null {
	if (snapshots.length === 0) return null;
	const targetMs = new Date(targetDate).getTime();
	return snapshots.reduce((nearest, snap) => {
		const snapDiff = Math.abs(new Date(snap.weekStart).getTime() - targetMs);
		const nearDiff = Math.abs(new Date(nearest.weekStart).getTime() - targetMs);
		return snapDiff < nearDiff ? snap : nearest;
	});
}

/** Load the cognitive profile store from IndexedDB; returns defaults if absent. */
export async function loadCognitiveProfileStore(): Promise<CognitiveProfileStore> {
	const stored = await idbGet<CognitiveProfileStore>(COGNITIVE_PROFILE_IDB_KEY);
	return stored ?? { profile: { ...DEFAULT_COGNITIVE_PROFILE }, snapshots: [] };
}

/** Persist the cognitive profile store to IndexedDB. */
export async function saveCognitiveProfileStore(store: CognitiveProfileStore): Promise<void> {
	await idbSet(COGNITIVE_PROFILE_IDB_KEY, store);
}

/**
 * Tests for the 5-axis ELO-like cognitive rating system.
 */
import { describe, it, expect } from 'vitest';
import {
	kFactor,
	applyEloUpdate,
	vocabularyDepthPerformance,
	processingSpeedPerformance,
	patternRecognitionPerformance,
	workingMemoryPerformance,
	strategicThinkingPerformance,
	updateProfileDimension,
	compositeScore,
	weekStart,
	upsertWeeklySnapshot,
	dimensionTrend,
	getSnapshotNearDate,
	DEFAULT_COGNITIVE_PROFILE
} from './cognitiveRating.js';
import type { CognitiveProfile, DimensionRating, WeeklySnapshot } from './cognitiveRating.js';

// ---------------------------------------------------------------------------
// kFactor
// ---------------------------------------------------------------------------

describe('kFactor', () => {
	it('returns 32 for first game (1 game played)', () => {
		expect(kFactor(1)).toBe(32);
	});

	it('returns 32 for 10th game', () => {
		expect(kFactor(10)).toBe(32);
	});

	it('returns 16 for 11th game', () => {
		expect(kFactor(11)).toBe(16);
	});

	it('returns 16 for 20th game', () => {
		expect(kFactor(20)).toBe(16);
	});

	it('returns 8 for 21st game', () => {
		expect(kFactor(21)).toBe(8);
	});

	it('returns 8 for 100th game', () => {
		expect(kFactor(100)).toBe(8);
	});
});

// ---------------------------------------------------------------------------
// applyEloUpdate
// ---------------------------------------------------------------------------

describe('applyEloUpdate', () => {
	const baseDim: DimensionRating = { rating: 1000, gamesPlayed: 0, lastUpdated: '' };

	it('rating increases on above-neutral performance (>0.5)', () => {
		const result = applyEloUpdate(baseDim, 1.0, '2026-01-01');
		expect(result.rating).toBeGreaterThan(1000);
	});

	it('rating decreases on below-neutral performance (<0.5)', () => {
		const result = applyEloUpdate(baseDim, 0.0, '2026-01-01');
		expect(result.rating).toBeLessThan(1000);
	});

	it('rating unchanged on exactly neutral performance (0.5)', () => {
		const result = applyEloUpdate(baseDim, 0.5, '2026-01-01');
		expect(result.rating).toBe(1000);
	});

	it('increments gamesPlayed by 1', () => {
		const result = applyEloUpdate(baseDim, 0.5, '2026-01-01');
		expect(result.gamesPlayed).toBe(1);
	});

	it('stores lastUpdated date', () => {
		const result = applyEloUpdate(baseDim, 0.5, '2026-03-01');
		expect(result.lastUpdated).toBe('2026-03-01');
	});

	it('clamps rating to minimum 100', () => {
		const lowDim: DimensionRating = { rating: 105, gamesPlayed: 50, lastUpdated: '' };
		// K=8, performance=0 → delta = 8*(0-0.5) = -4 → 101; repeated calls will hit 100
		const result = applyEloUpdate({ ...lowDim, rating: 100 }, 0, '2026-01-01');
		expect(result.rating).toBe(100);
	});

	it('clamps rating to maximum 3000', () => {
		const highDim: DimensionRating = { rating: 3000, gamesPlayed: 50, lastUpdated: '' };
		const result = applyEloUpdate(highDim, 1.0, '2026-01-01');
		expect(result.rating).toBe(3000);
	});

	it('clamps input performance above 1 to 1', () => {
		const result = applyEloUpdate(baseDim, 2.0, '2026-01-01');
		const expected = applyEloUpdate(baseDim, 1.0, '2026-01-01');
		expect(result.rating).toBe(expected.rating);
	});

	it('clamps input performance below 0 to 0', () => {
		const result = applyEloUpdate(baseDim, -1.0, '2026-01-01');
		const expected = applyEloUpdate(baseDim, 0.0, '2026-01-01');
		expect(result.rating).toBe(expected.rating);
	});

	it('uses K=32 on first update (games 0→1)', () => {
		const result = applyEloUpdate(baseDim, 1.0, '2026-01-01');
		// delta = 32 * (1.0 - 0.5) = 16
		expect(result.rating).toBe(1016);
	});

	it('uses K=16 on 11th update', () => {
		const dim: DimensionRating = { rating: 1000, gamesPlayed: 10, lastUpdated: '' };
		const result = applyEloUpdate(dim, 1.0, '2026-01-01');
		// delta = 16 * (1.0 - 0.5) = 8
		expect(result.rating).toBe(1008);
	});

	it('uses K=8 on 21st update', () => {
		const dim: DimensionRating = { rating: 1000, gamesPlayed: 20, lastUpdated: '' };
		const result = applyEloUpdate(dim, 1.0, '2026-01-01');
		// delta = 8 * (1.0 - 0.5) = 4
		expect(result.rating).toBe(1004);
	});

	it('does not mutate original dimension', () => {
		applyEloUpdate(baseDim, 0.8, '2026-01-01');
		expect(baseDim.rating).toBe(1000);
		expect(baseDim.gamesPlayed).toBe(0);
	});
});

// ---------------------------------------------------------------------------
// vocabularyDepthPerformance
// ---------------------------------------------------------------------------

describe('vocabularyDepthPerformance', () => {
	it('returns 0 for empty game (0 words, rarity 1, length 3)', () => {
		const score = vocabularyDepthPerformance({
			uniqueWordCount: 0,
			avgRarityMultiplier: 1,
			avgWordLength: 3
		});
		expect(score).toBe(0);
	});

	it('returns 1.0 for excellent performance (15 words, rarity 5, length 8)', () => {
		const score = vocabularyDepthPerformance({
			uniqueWordCount: 15,
			avgRarityMultiplier: 5,
			avgWordLength: 8
		});
		expect(score).toBe(1.0);
	});

	it('caps at 1.0 when inputs exceed maximums', () => {
		const score = vocabularyDepthPerformance({
			uniqueWordCount: 100,
			avgRarityMultiplier: 5,
			avgWordLength: 20
		});
		expect(score).toBe(1.0);
	});

	it('returns intermediate value for average performance', () => {
		const score = vocabularyDepthPerformance({
			uniqueWordCount: 7,
			avgRarityMultiplier: 2.5,
			avgWordLength: 5.5
		});
		expect(score).toBeGreaterThan(0);
		expect(score).toBeLessThan(1);
	});
});

// ---------------------------------------------------------------------------
// processingSpeedPerformance
// ---------------------------------------------------------------------------

describe('processingSpeedPerformance', () => {
	it('returns 1.0 for excellent performance', () => {
		const score = processingSpeedPerformance({
			wordsPerMinute: 4,
			avgSecondsPerWord: 3,
			comboConsistency: 1
		});
		expect(score).toBe(1.0);
	});

	it('returns 0 for worst performance', () => {
		const score = processingSpeedPerformance({
			wordsPerMinute: 0,
			avgSecondsPerWord: 20,
			comboConsistency: 0
		});
		expect(score).toBeGreaterThanOrEqual(0);
		expect(score).toBeLessThanOrEqual(0.1);
	});

	it('returns intermediate value for average performance', () => {
		const score = processingSpeedPerformance({
			wordsPerMinute: 2,
			avgSecondsPerWord: 10,
			comboConsistency: 0.5
		});
		expect(score).toBeGreaterThan(0);
		expect(score).toBeLessThan(1);
	});
});

// ---------------------------------------------------------------------------
// patternRecognitionPerformance
// ---------------------------------------------------------------------------

describe('patternRecognitionPerformance', () => {
	it('returns 1.0 for 4-chain and full utilisation', () => {
		const score = patternRecognitionPerformance({
			longestChain: 4,
			novelBoardUtilisation: 1.0
		});
		expect(score).toBe(1.0);
	});

	it('returns 0 for no chains and 0 utilisation', () => {
		const score = patternRecognitionPerformance({
			longestChain: 0,
			novelBoardUtilisation: 0
		});
		expect(score).toBe(0);
	});

	it('caps chain score at 1.0 for chains > 4', () => {
		const capped = patternRecognitionPerformance({ longestChain: 10, novelBoardUtilisation: 1 });
		const max = patternRecognitionPerformance({ longestChain: 4, novelBoardUtilisation: 1 });
		expect(capped).toBe(max);
	});
});

// ---------------------------------------------------------------------------
// workingMemoryPerformance
// ---------------------------------------------------------------------------

describe('workingMemoryPerformance', () => {
	it('returns 1.0 for 5 rounds and perfect accuracy', () => {
		const score = workingMemoryPerformance({ roundsSurvived: 5, accuracy: 1.0 });
		expect(score).toBe(1.0);
	});

	it('returns 0 for 0 rounds and 0 accuracy', () => {
		const score = workingMemoryPerformance({ roundsSurvived: 0, accuracy: 0 });
		expect(score).toBe(0);
	});

	it('caps at 1.0 for rounds > 5', () => {
		const capped = workingMemoryPerformance({ roundsSurvived: 10, accuracy: 1.0 });
		expect(capped).toBe(1.0);
	});
});

// ---------------------------------------------------------------------------
// strategicThinkingPerformance
// ---------------------------------------------------------------------------

describe('strategicThinkingPerformance', () => {
	it('returns 1.0 for 5 stars and perfect efficiency (ratio 0.5)', () => {
		const score = strategicThinkingPerformance({ starRating: 5, moveEfficiencyRatio: 0.5 });
		expect(score).toBe(1.0);
	});

	it('returns 0 for 1 star and very poor efficiency (ratio >= 1.5)', () => {
		const score = strategicThinkingPerformance({ starRating: 1, moveEfficiencyRatio: 1.5 });
		expect(score).toBe(0);
	});

	it('returns intermediate value for 3 stars on-par moves', () => {
		const score = strategicThinkingPerformance({ starRating: 3, moveEfficiencyRatio: 1.0 });
		expect(score).toBeGreaterThan(0);
		expect(score).toBeLessThan(1);
	});
});

// ---------------------------------------------------------------------------
// updateProfileDimension
// ---------------------------------------------------------------------------

describe('updateProfileDimension', () => {
	it('updates the specified dimension without mutating others', () => {
		const profile: CognitiveProfile = JSON.parse(JSON.stringify(DEFAULT_COGNITIVE_PROFILE));
		const updated = updateProfileDimension(profile, 'vocabularyDepth', 1.0, '2026-01-01');
		expect(updated.vocabularyDepth.rating).toBeGreaterThan(1000);
		expect(updated.processingSpeed.rating).toBe(1000);
		expect(updated.patternRecognition.rating).toBe(1000);
		expect(updated.workingMemory.rating).toBe(1000);
		expect(updated.strategicThinking.rating).toBe(1000);
	});

	it('does not mutate the original profile', () => {
		const profile: CognitiveProfile = JSON.parse(JSON.stringify(DEFAULT_COGNITIVE_PROFILE));
		updateProfileDimension(profile, 'vocabularyDepth', 1.0, '2026-01-01');
		expect(profile.vocabularyDepth.rating).toBe(1000);
	});
});

// ---------------------------------------------------------------------------
// compositeScore
// ---------------------------------------------------------------------------

describe('compositeScore', () => {
	it('returns 1000 for a default profile (all dimensions at 1000)', () => {
		const profile: CognitiveProfile = JSON.parse(JSON.stringify(DEFAULT_COGNITIVE_PROFILE));
		expect(compositeScore(profile)).toBe(1000);
	});

	it('returns the mean of all dimension ratings', () => {
		const profile: CognitiveProfile = JSON.parse(JSON.stringify(DEFAULT_COGNITIVE_PROFILE));
		profile.vocabularyDepth.rating = 1200;
		profile.processingSpeed.rating = 800;
		// others remain at 1000
		expect(compositeScore(profile)).toBe(1000);
	});

	it('rounds to nearest integer', () => {
		const profile: CognitiveProfile = JSON.parse(JSON.stringify(DEFAULT_COGNITIVE_PROFILE));
		profile.vocabularyDepth.rating = 1001;
		// (1001 + 1000 + 1000 + 1000 + 1000) / 5 = 1000.2 → rounds to 1000
		expect(compositeScore(profile)).toBe(1000);
	});
});

// ---------------------------------------------------------------------------
// weekStart
// ---------------------------------------------------------------------------

describe('weekStart', () => {
	it('returns Monday for a Monday date', () => {
		// 2026-03-23 is a Monday
		expect(weekStart('2026-03-23')).toBe('2026-03-23');
	});

	it('returns the preceding Monday for a Wednesday', () => {
		// 2026-03-25 is a Wednesday → Monday 2026-03-23
		expect(weekStart('2026-03-25')).toBe('2026-03-23');
	});

	it('returns the preceding Monday for a Sunday', () => {
		// 2026-03-29 is a Sunday → Monday 2026-03-23
		expect(weekStart('2026-03-29')).toBe('2026-03-23');
	});

	it('returns the preceding Monday for a Saturday', () => {
		// 2026-03-28 is a Saturday → Monday 2026-03-23
		expect(weekStart('2026-03-28')).toBe('2026-03-23');
	});
});

// ---------------------------------------------------------------------------
// upsertWeeklySnapshot
// ---------------------------------------------------------------------------

describe('upsertWeeklySnapshot', () => {
	const profile: CognitiveProfile = JSON.parse(JSON.stringify(DEFAULT_COGNITIVE_PROFILE));

	it('adds a snapshot to an empty list', () => {
		const result = upsertWeeklySnapshot([], profile, '2026-03-23');
		expect(result).toHaveLength(1);
		expect(result[0].weekStart).toBe('2026-03-23');
	});

	it('replaces an existing snapshot for the same week', () => {
		const initial = upsertWeeklySnapshot([], profile, '2026-03-23');
		const updated = JSON.parse(JSON.stringify(DEFAULT_COGNITIVE_PROFILE)) as CognitiveProfile;
		updated.vocabularyDepth.rating = 1100;
		const result = upsertWeeklySnapshot(initial, updated, '2026-03-25'); // same week
		expect(result).toHaveLength(1);
		expect(result[0].ratings.vocabularyDepth).toBe(1100);
	});

	it('adds a new snapshot for a different week', () => {
		const initial = upsertWeeklySnapshot([], profile, '2026-03-23');
		const result = upsertWeeklySnapshot(initial, profile, '2026-03-30'); // next week
		expect(result).toHaveLength(2);
	});

	it('prunes snapshots older than 56 days', () => {
		// Create a snapshot from 60 days ago
		const old: WeeklySnapshot = {
			weekStart: '2026-01-20', // ~63 days before 2026-03-24
			ratings: {
				vocabularyDepth: 1000,
				processingSpeed: 1000,
				patternRecognition: 1000,
				workingMemory: 1000,
				strategicThinking: 1000
			}
		};
		const result = upsertWeeklySnapshot([old], profile, '2026-03-24');
		const hasOld = result.some((s) => s.weekStart === '2026-01-20');
		expect(hasOld).toBe(false);
	});

	it('retains snapshots within 56 days', () => {
		// 30 days before 2026-03-24 = 2026-02-22 (within 56-day window)
		const recent: WeeklySnapshot = {
			weekStart: '2026-02-23',
			ratings: {
				vocabularyDepth: 1050,
				processingSpeed: 1050,
				patternRecognition: 1050,
				workingMemory: 1050,
				strategicThinking: 1050
			}
		};
		const result = upsertWeeklySnapshot([recent], profile, '2026-03-24');
		const hasRecent = result.some((s) => s.weekStart === '2026-02-23');
		expect(hasRecent).toBe(true);
	});
});

// ---------------------------------------------------------------------------
// getSnapshotNearDate
// ---------------------------------------------------------------------------

describe('getSnapshotNearDate', () => {
	const makeSnap = (weekStart: string, rating = 1000): WeeklySnapshot => ({
		weekStart,
		ratings: {
			vocabularyDepth: rating,
			processingSpeed: rating,
			patternRecognition: rating,
			workingMemory: rating,
			strategicThinking: rating
		}
	});

	it('returns null for an empty snapshots array', () => {
		expect(getSnapshotNearDate([], '2026-03-24')).toBeNull();
	});

	it('returns the only snapshot when there is one', () => {
		const snap = makeSnap('2026-03-23');
		expect(getSnapshotNearDate([snap], '2026-03-24')).toEqual(snap);
	});

	it('returns the snapshot nearest to the target date', () => {
		const near = makeSnap('2026-02-23'); // 29 days before 2026-03-24
		const far = makeSnap('2026-01-05'); // 78 days before 2026-03-24
		expect(getSnapshotNearDate([far, near], '2026-03-24')).toEqual(near);
	});

	it('returns the correct snapshot when target is between two equidistant snaps', () => {
		// 2026-03-17 is 7 days before, 2026-03-31 is 7 days after target 2026-03-24
		const before = makeSnap('2026-03-17', 1100);
		const after = makeSnap('2026-03-31', 1200);
		// Either is valid for exactly equidistant; just check it returns one of them
		const result = getSnapshotNearDate([before, after], '2026-03-24');
		expect([before, after]).toContainEqual(result);
	});

	it('does not mutate the input array', () => {
		const snaps = [makeSnap('2026-03-09'), makeSnap('2026-03-16')];
		const copy = [...snaps];
		getSnapshotNearDate(snaps, '2026-03-24');
		expect(snaps).toEqual(copy);
	});
});

// ---------------------------------------------------------------------------
// dimensionTrend
// ---------------------------------------------------------------------------

describe('dimensionTrend', () => {
	it('returns an empty array for no snapshots', () => {
		expect(dimensionTrend([], 'vocabularyDepth')).toEqual([]);
	});

	it('returns trend data for the specified dimension', () => {
		const snapshots: WeeklySnapshot[] = [
			{
				weekStart: '2026-03-09',
				ratings: {
					vocabularyDepth: 1050,
					processingSpeed: 980,
					patternRecognition: 1000,
					workingMemory: 1000,
					strategicThinking: 1000
				}
			},
			{
				weekStart: '2026-03-16',
				ratings: {
					vocabularyDepth: 1066,
					processingSpeed: 996,
					patternRecognition: 1000,
					workingMemory: 1000,
					strategicThinking: 1000
				}
			}
		];
		const trend = dimensionTrend(snapshots, 'vocabularyDepth');
		expect(trend).toHaveLength(2);
		expect(trend[0]).toEqual({ weekStart: '2026-03-09', rating: 1050 });
		expect(trend[1]).toEqual({ weekStart: '2026-03-16', rating: 1066 });
	});
});

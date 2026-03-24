/**
 * Tests for Forge Rank progression system.
 */
import { describe, it, expect } from 'vitest';
import {
	rankTierForScore,
	computeForgeRank,
	isRankUp,
	tierInfoForTier,
	RANK_TIERS
} from './forgeRank.js';

// ---------------------------------------------------------------------------
// rankTierForScore
// ---------------------------------------------------------------------------

describe('rankTierForScore', () => {
	it('returns Spark for score 0', () => {
		expect(rankTierForScore(0).tier).toBe('Spark');
	});

	it('returns Spark for score 999', () => {
		expect(rankTierForScore(999).tier).toBe('Spark');
	});

	it('returns Ember for score 1000', () => {
		expect(rankTierForScore(1000).tier).toBe('Ember');
	});

	it('returns Ember for score 1499', () => {
		expect(rankTierForScore(1499).tier).toBe('Ember');
	});

	it('returns Flame for score 1500', () => {
		expect(rankTierForScore(1500).tier).toBe('Flame');
	});

	it('returns Flame for score 1999', () => {
		expect(rankTierForScore(1999).tier).toBe('Flame');
	});

	it('returns Blaze for score 2000', () => {
		expect(rankTierForScore(2000).tier).toBe('Blaze');
	});

	it('returns Blaze for score 2499', () => {
		expect(rankTierForScore(2499).tier).toBe('Blaze');
	});

	it('returns Inferno for score 2500', () => {
		expect(rankTierForScore(2500).tier).toBe('Inferno');
	});

	it('returns Inferno for score 2999', () => {
		expect(rankTierForScore(2999).tier).toBe('Inferno');
	});

	it('returns Forge Master for score 3000', () => {
		expect(rankTierForScore(3000).tier).toBe('Forge Master');
	});

	it('returns Forge Master for score 3499', () => {
		expect(rankTierForScore(3499).tier).toBe('Forge Master');
	});

	it('returns Legendary for score 3500', () => {
		expect(rankTierForScore(3500).tier).toBe('Legendary');
	});

	it('returns Legendary for very high score', () => {
		expect(rankTierForScore(9999).tier).toBe('Legendary');
	});

	it('clamps to Spark for negative score', () => {
		expect(rankTierForScore(-100).tier).toBe('Spark');
	});
});

// ---------------------------------------------------------------------------
// computeForgeRank
// ---------------------------------------------------------------------------

describe('computeForgeRank', () => {
	it('returns Spark tier for composite score 500', () => {
		const rank = computeForgeRank(500);
		expect(rank.tier).toBe('Spark');
		expect(rank.compositeScore).toBe(500);
	});

	it('pointsToNextTier is correct in middle of Spark band', () => {
		// Spark: 0-999, score 500 → next tier at 1000 → 500 points needed
		const rank = computeForgeRank(500);
		expect(rank.pointsToNextTier).toBe(500);
	});

	it('tierProgress is 0 at bottom of tier', () => {
		// Ember: 1000-1499, score 1000 → progress = 0/500 = 0
		const rank = computeForgeRank(1000);
		expect(rank.tierProgress).toBeCloseTo(0, 5);
	});

	it('tierProgress is 0.5 at midpoint of tier', () => {
		// Ember: 1000-1499 (500 wide), score 1250 → (250/500) = 0.5
		const rank = computeForgeRank(1250);
		expect(rank.tierProgress).toBeCloseTo(0.5, 5);
	});

	it('pointsToNextTier is 1 at top of Ember', () => {
		const rank = computeForgeRank(1499);
		expect(rank.pointsToNextTier).toBe(1);
	});

	it('Legendary has tierProgress 1 and pointsToNextTier 0', () => {
		const rank = computeForgeRank(3500);
		expect(rank.tier).toBe('Legendary');
		expect(rank.tierProgress).toBe(1);
		expect(rank.pointsToNextTier).toBe(0);
	});

	it('Legendary stays at tierProgress 1 for any higher score', () => {
		const rank = computeForgeRank(5000);
		expect(rank.tierProgress).toBe(1);
		expect(rank.pointsToNextTier).toBe(0);
	});

	it('clamps negative score to 0', () => {
		const rank = computeForgeRank(-50);
		expect(rank.compositeScore).toBe(0);
		expect(rank.tier).toBe('Spark');
	});
});

// ---------------------------------------------------------------------------
// isRankUp
// ---------------------------------------------------------------------------

describe('isRankUp', () => {
	it('returns false when score does not change', () => {
		expect(isRankUp(1000, 1000)).toBe(false);
	});

	it('returns false when new score is lower', () => {
		expect(isRankUp(1200, 1100)).toBe(false);
	});

	it('returns false when improvement stays within same tier', () => {
		// Both in Ember (1000–1499)
		expect(isRankUp(1100, 1300)).toBe(false);
	});

	it('returns true when score crosses a tier boundary', () => {
		// 999 (Spark) → 1000 (Ember)
		expect(isRankUp(999, 1000)).toBe(true);
	});

	it('returns true when multiple tiers are crossed', () => {
		// 999 (Spark) → 1500 (Flame)
		expect(isRankUp(999, 1500)).toBe(true);
	});

	it('returns true on crossing into Legendary', () => {
		expect(isRankUp(3499, 3500)).toBe(true);
	});
});

// ---------------------------------------------------------------------------
// tierInfoForTier
// ---------------------------------------------------------------------------

describe('tierInfoForTier', () => {
	it('returns correct info for Spark', () => {
		const info = tierInfoForTier('Spark');
		expect(info.tier).toBe('Spark');
		expect(info.minScore).toBe(0);
		expect(info.emoji).toBeTruthy();
	});

	it('returns correct info for Legendary', () => {
		const info = tierInfoForTier('Legendary');
		expect(info.tier).toBe('Legendary');
		expect(info.maxScore).toBeNull();
	});

	it('returns info for every tier in RANK_TIERS', () => {
		for (const tierInfo of RANK_TIERS) {
			const result = tierInfoForTier(tierInfo.tier);
			expect(result.tier).toBe(tierInfo.tier);
		}
	});
});

// ---------------------------------------------------------------------------
// RANK_TIERS completeness
// ---------------------------------------------------------------------------

describe('RANK_TIERS', () => {
	it('contains exactly 7 tiers', () => {
		expect(RANK_TIERS).toHaveLength(7);
	});

	it('tiers are ordered by ascending minScore', () => {
		for (let i = 1; i < RANK_TIERS.length; i++) {
			expect(RANK_TIERS[i].minScore).toBeGreaterThan(RANK_TIERS[i - 1].minScore);
		}
	});

	it('each tier maxScore + 1 equals the next tier minScore (no gaps)', () => {
		for (let i = 0; i < RANK_TIERS.length - 1; i++) {
			const current = RANK_TIERS[i];
			const next = RANK_TIERS[i + 1];
			expect(current.maxScore! + 1).toBe(next.minScore);
		}
	});

	it('last tier has null maxScore (open-ended)', () => {
		expect(RANK_TIERS[RANK_TIERS.length - 1].maxScore).toBeNull();
	});
});

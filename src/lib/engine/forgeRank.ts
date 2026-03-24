/**
 * Forge Rank progression system.
 *
 * Seven tiers determined by the composite cognitive score:
 *   Spark (0–999) → Ember (1000–1499) → Flame (1500–1999) →
 *   Blaze (2000–2499) → Inferno (2500–2999) → Forge Master (3000–3499) →
 *   Legendary (3500+)
 */

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type ForgeRankTier =
	| 'Spark'
	| 'Ember'
	| 'Flame'
	| 'Blaze'
	| 'Inferno'
	| 'Forge Master'
	| 'Legendary';

export interface RankTierInfo {
	tier: ForgeRankTier;
	/** Minimum composite score required (inclusive). */
	minScore: number;
	/** Maximum composite score (inclusive), or null if this is the top tier. */
	maxScore: number | null;
	/** Emoji badge for display. */
	emoji: string;
	/** Tailwind / CSS colour class for theming. */
	colorClass: string;
}

export interface ForgeRankState {
	/** The currently achieved tier. */
	tier: ForgeRankTier;
	/** The composite score that produced this tier. */
	compositeScore: number;
	/** Points needed to reach the next tier (0 if already Legendary). */
	pointsToNextTier: number;
	/** Progress through the current tier band, 0–1. */
	tierProgress: number;
}

// ---------------------------------------------------------------------------
// Tier table (ordered lowest to highest)
// ---------------------------------------------------------------------------

export const RANK_TIERS: RankTierInfo[] = [
	{ tier: 'Spark', minScore: 0, maxScore: 999, emoji: '✨', colorClass: 'text-gray-400' },
	{ tier: 'Ember', minScore: 1000, maxScore: 1499, emoji: '🔥', colorClass: 'text-orange-400' },
	{ tier: 'Flame', minScore: 1500, maxScore: 1999, emoji: '🌟', colorClass: 'text-yellow-400' },
	{ tier: 'Blaze', minScore: 2000, maxScore: 2499, emoji: '⚡', colorClass: 'text-amber-500' },
	{ tier: 'Inferno', minScore: 2500, maxScore: 2999, emoji: '🌋', colorClass: 'text-red-500' },
	{
		tier: 'Forge Master',
		minScore: 3000,
		maxScore: 3499,
		emoji: '⚒️',
		colorClass: 'text-purple-400'
	},
	{ tier: 'Legendary', minScore: 3500, maxScore: null, emoji: '👑', colorClass: 'text-yellow-300' }
];

// ---------------------------------------------------------------------------
// Pure helpers
// ---------------------------------------------------------------------------

/**
 * Returns the RankTierInfo for the given composite score.
 */
export function rankTierForScore(score: number): RankTierInfo {
	// Walk tiers from highest to lowest; return the first one the score qualifies for.
	for (let i = RANK_TIERS.length - 1; i >= 0; i--) {
		if (score >= RANK_TIERS[i].minScore) {
			return RANK_TIERS[i];
		}
	}
	// Score below 0 — clamp to Spark
	return RANK_TIERS[0];
}

/**
 * Builds a full ForgeRankState from a raw composite score.
 */
export function computeForgeRank(score: number): ForgeRankState {
	const clamped = Math.max(0, score);
	const tierInfo = rankTierForScore(clamped);

	// Progress and points-to-next
	let pointsToNextTier: number;
	let tierProgress: number;

	if (tierInfo.maxScore === null) {
		// Legendary — already top tier
		pointsToNextTier = 0;
		tierProgress = 1;
	} else {
		const bandSize = tierInfo.maxScore - tierInfo.minScore + 1;
		const positionInBand = clamped - tierInfo.minScore;
		tierProgress = Math.min(positionInBand / bandSize, 1);
		pointsToNextTier = tierInfo.maxScore + 1 - clamped;
	}

	return {
		tier: tierInfo.tier,
		compositeScore: clamped,
		pointsToNextTier,
		tierProgress
	};
}

/**
 * Returns true if `newScore` crosses into a higher tier than `oldScore`.
 * Useful for triggering the rank-up ceremony.
 */
export function isRankUp(oldScore: number, newScore: number): boolean {
	if (newScore <= oldScore) return false;
	return rankTierForScore(oldScore).tier !== rankTierForScore(newScore).tier;
}

/**
 * Returns the tier that would be reached at `score`.
 * Convenience wrapper for template use.
 */
export function tierInfoForTier(tier: ForgeRankTier): RankTierInfo {
	return RANK_TIERS.find((t) => t.tier === tier) ?? RANK_TIERS[0];
}

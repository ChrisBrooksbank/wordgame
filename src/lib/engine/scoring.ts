/**
 * Scoring system for Lexicon Forge.
 *
 * Base score: length² (3→9, 4→16, 5→25, 6→36, 7→49, 8→64, …)
 * Rarity multiplier: 1x–5x derived from average letter frequency of the word.
 * Common English letters (E, T, A, …) produce low-multiplier words;
 * rare letters (Q, Z, X, J, …) push words into higher-multiplier tiers.
 */

export type RarityTier = 'common' | 'uncommon' | 'rare' | 'epic' | 'obscure';

export interface ScoreBreakdown {
	base: number;
	multiplier: 1 | 2 | 3 | 4 | 5;
	total: number;
	rarity: RarityTier;
}

/** English letter frequencies (percent, A–Z). */
const LETTER_FREQUENCY: Record<string, number> = {
	A: 8.17,
	B: 1.49,
	C: 2.78,
	D: 4.25,
	E: 12.7,
	F: 2.23,
	G: 2.02,
	H: 6.09,
	I: 6.97,
	J: 0.15,
	K: 0.77,
	L: 4.03,
	M: 2.41,
	N: 6.75,
	O: 7.51,
	P: 1.93,
	Q: 0.1,
	R: 5.99,
	S: 6.33,
	T: 9.06,
	U: 2.76,
	V: 0.98,
	W: 2.36,
	X: 0.15,
	Y: 1.97,
	Z: 0.07
};

const RARITY_MULTIPLIERS: Record<RarityTier, 1 | 2 | 3 | 4 | 5> = {
	common: 1,
	uncommon: 2,
	rare: 3,
	epic: 4,
	obscure: 5
};

/**
 * Derives a rarity tier from the word's average letter frequency.
 * High-frequency letters → common; low-frequency letters → obscure.
 */
export function getWordRarity(word: string): RarityTier {
	if (word.length === 0) return 'common';
	const upper = word.toUpperCase();
	let total = 0;
	for (const ch of upper) {
		total += LETTER_FREQUENCY[ch] ?? 0;
	}
	const avg = total / upper.length;

	if (avg >= 5.0) return 'common';
	if (avg >= 3.5) return 'uncommon';
	if (avg >= 2.5) return 'rare';
	if (avg >= 1.5) return 'epic';
	return 'obscure';
}

/**
 * Calculates the full score breakdown for a submitted word.
 * Minimum word length for scoring is 3 (returns 0 total for shorter words).
 */
export function calculateScore(word: string): ScoreBreakdown {
	const len = word.length;
	if (len < 3) {
		return { base: 0, multiplier: 1, total: 0, rarity: 'common' };
	}
	const base = len * len;
	const rarity = getWordRarity(word);
	const multiplier = RARITY_MULTIPLIERS[rarity];
	return { base, multiplier, total: base * multiplier, rarity };
}

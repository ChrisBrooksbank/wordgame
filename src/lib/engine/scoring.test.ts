import { describe, it, expect } from 'vitest';
import { calculateScore, getWordRarity } from './scoring.js';

describe('calculateScore base score (length²)', () => {
	it('3-letter word has base 9', () => {
		expect(calculateScore('CAT').base).toBe(9);
	});
	it('4-letter word has base 16', () => {
		expect(calculateScore('CATS').base).toBe(16);
	});
	it('5-letter word has base 25', () => {
		expect(calculateScore('CRANE').base).toBe(25);
	});
	it('6-letter word has base 36', () => {
		expect(calculateScore('STARED').base).toBe(36);
	});
	it('7-letter word has base 49', () => {
		expect(calculateScore('STRIDES').base).toBe(49);
	});
	it('8-letter word has base 64', () => {
		expect(calculateScore('STRENGTH').base).toBe(64);
	});
	it('word shorter than 3 returns total 0', () => {
		expect(calculateScore('IT').total).toBe(0);
		expect(calculateScore('A').total).toBe(0);
	});
});

describe('calculateScore total = base × multiplier', () => {
	it('total equals base times multiplier', () => {
		const result = calculateScore('CAT');
		expect(result.total).toBe(result.base * result.multiplier);
	});
	it('works for all rarity tiers', () => {
		const words = ['EATEN', 'PLANT', 'BLANK', 'VIVID', 'JAZZ'];
		for (const w of words) {
			const r = calculateScore(w);
			expect(r.total).toBe(r.base * r.multiplier);
		}
	});
});

describe('getWordRarity', () => {
	it('high-frequency letters (E, T, A, O, I, N, S, H) → common (1x)', () => {
		// "STONE" — all very common letters
		expect(getWordRarity('STONE')).toBe('common');
	});

	it('multiplier for common words is 1', () => {
		expect(calculateScore('STONE').multiplier).toBe(1);
	});

	it('words with rare letters (Q, Z) are not common', () => {
		// QUARTZ avg letter freq ≈ 4.36 → uncommon (Q and Z drag it down from common)
		const rarityQ = getWordRarity('QUARTZ');
		expect(rarityQ).toBe('uncommon');
		expect(calculateScore('QUARTZ').multiplier).toBe(2);
	});

	it('empty string returns common', () => {
		expect(getWordRarity('')).toBe('common');
	});

	it('case-insensitive', () => {
		expect(getWordRarity('stone')).toBe(getWordRarity('STONE'));
		expect(getWordRarity('quartz')).toBe(getWordRarity('QUARTZ'));
	});

	it('multiplier is between 1 and 5 inclusive', () => {
		const words = ['THE', 'STONE', 'BLANK', 'VIVID', 'JAZZ', 'QUARTZ', 'ZINGY'];
		for (const w of words) {
			const m = calculateScore(w).multiplier;
			expect(m).toBeGreaterThanOrEqual(1);
			expect(m).toBeLessThanOrEqual(5);
		}
	});
});

describe('rarity tiers produce correct multipliers', () => {
	it('common → 1x', () => {
		const r = calculateScore('STONE');
		expect(r.rarity).toBe('common');
		expect(r.multiplier).toBe(1);
	});

	it('JAZZ is epic (4x) — avg letter freq ≈ 2.12', () => {
		// J(0.15)+A(8.17)+Z(0.07)+Z(0.07) = 8.46/4 = 2.115 → epic
		const r = calculateScore('JAZZ');
		expect(r.rarity).toBe('epic');
		expect(r.multiplier).toBe(4);
	});

	it('ZYZZYVA is epic (4x) — Y and A raise average above 1.5', () => {
		// Z(0.07)+Y(1.97)+Z(0.07)+Z(0.07)+Y(1.97)+V(0.98)+A(8.17) = 13.3/7 ≈ 1.9 → epic
		const r = calculateScore('ZYZZYVA');
		expect(r.rarity).toBe('epic');
		expect(r.multiplier).toBe(4);
	});
});

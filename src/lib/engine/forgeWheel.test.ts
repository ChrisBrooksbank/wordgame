import { describe, it, expect } from 'vitest';
import {
	WHEEL_SEGMENTS,
	selectSegment,
	segmentStartAngle,
	segmentCenterAngle,
	wheelRng
} from './forgeWheel.js';

describe('WHEEL_SEGMENTS', () => {
	it('has positive weights summing to 100', () => {
		const total = WHEEL_SEGMENTS.reduce((s, seg) => s + seg.weight, 0);
		expect(total).toBe(100);
	});

	it('each segment has required fields', () => {
		for (const seg of WHEEL_SEGMENTS) {
			expect(seg.reward.type).toMatch(/^(sparks|rare_word_card|cosmetic_item)$/);
			expect(seg.reward.label).toBeTruthy();
			expect(seg.color).toMatch(/^#/);
			expect(seg.emoji).toBeTruthy();
			expect(seg.weight).toBeGreaterThan(0);
		}
	});

	it('sparks rewards have an amount', () => {
		for (const seg of WHEEL_SEGMENTS) {
			if (seg.reward.type === 'sparks') {
				expect(seg.reward.amount).toBeGreaterThan(0);
			}
		}
	});
});

describe('selectSegment', () => {
	it('returns a valid index for any RNG output', () => {
		// Test edge cases: 0, near-1, and mid-range
		const edge0 = () => 0;
		const edgeMax = () => 0.9999;

		expect(selectSegment(edge0)).toBeGreaterThanOrEqual(0);
		expect(selectSegment(edge0)).toBeLessThan(WHEEL_SEGMENTS.length);
		expect(selectSegment(edgeMax)).toBeGreaterThanOrEqual(0);
		expect(selectSegment(edgeMax)).toBeLessThan(WHEEL_SEGMENTS.length);
	});

	it('distributes results proportionally to weights', () => {
		// Use a counter to verify weight distribution is roughly correct
		const counts = new Array(WHEEL_SEGMENTS.length).fill(0);
		const ITERATIONS = 10_000;

		// Deterministic pseudo-random via a simple LCG
		let seed = 42;
		const lcg = () => {
			seed = (seed * 1664525 + 1013904223) & 0xffffffff;
			return (seed >>> 0) / 0x100000000;
		};

		for (let i = 0; i < ITERATIONS; i++) {
			counts[selectSegment(lcg)]++;
		}

		// Check each segment hit within ±30% of expected (wide tolerance for variance)
		const totalWeight = WHEEL_SEGMENTS.reduce((s, seg) => s + seg.weight, 0);
		for (let i = 0; i < WHEEL_SEGMENTS.length; i++) {
			const expected = (WHEEL_SEGMENTS[i].weight / totalWeight) * ITERATIONS;
			expect(counts[i]).toBeGreaterThan(expected * 0.7);
			expect(counts[i]).toBeLessThan(expected * 1.3);
		}
	});

	it('always selects a segment (no undefined)', () => {
		const rng = wheelRng('2026-03-24');
		for (let i = 0; i < 100; i++) {
			const idx = selectSegment(rng);
			expect(WHEEL_SEGMENTS[idx]).toBeDefined();
		}
	});
});

describe('segmentStartAngle', () => {
	it('first segment starts at 0', () => {
		expect(segmentStartAngle(0)).toBe(0);
	});

	it('angles are monotonically increasing', () => {
		for (let i = 1; i < WHEEL_SEGMENTS.length; i++) {
			expect(segmentStartAngle(i)).toBeGreaterThan(segmentStartAngle(i - 1));
		}
	});

	it('last segment ends at 360', () => {
		const lastIndex = WHEEL_SEGMENTS.length - 1;
		const totalWeight = WHEEL_SEGMENTS.reduce((s, seg) => s + seg.weight, 0);
		const lastStart = segmentStartAngle(lastIndex);
		const lastSpan = (WHEEL_SEGMENTS[lastIndex].weight / totalWeight) * 360;
		expect(lastStart + lastSpan).toBeCloseTo(360, 5);
	});
});

describe('segmentCenterAngle', () => {
	it('center is between start and end of segment', () => {
		const totalWeight = WHEEL_SEGMENTS.reduce((s, seg) => s + seg.weight, 0);
		for (let i = 0; i < WHEEL_SEGMENTS.length; i++) {
			const start = segmentStartAngle(i);
			const span = (WHEEL_SEGMENTS[i].weight / totalWeight) * 360;
			const center = segmentCenterAngle(i);
			expect(center).toBeGreaterThan(start);
			expect(center).toBeLessThan(start + span);
		}
	});
});

describe('wheelRng', () => {
	it('returns a function that produces values in [0, 1)', () => {
		const rng = wheelRng('2026-03-24');
		for (let i = 0; i < 50; i++) {
			const v = rng();
			expect(v).toBeGreaterThanOrEqual(0);
			expect(v).toBeLessThan(1);
		}
	});

	it('same date produces same sequence', () => {
		const rng1 = wheelRng('2026-03-24');
		const rng2 = wheelRng('2026-03-24');
		for (let i = 0; i < 10; i++) {
			expect(rng1()).toBe(rng2());
		}
	});

	it('different dates produce different sequences', () => {
		const rng1 = wheelRng('2026-03-24');
		const rng2 = wheelRng('2026-03-25');
		const vals1 = Array.from({ length: 5 }, () => rng1());
		const vals2 = Array.from({ length: 5 }, () => rng2());
		expect(vals1).not.toEqual(vals2);
	});
});

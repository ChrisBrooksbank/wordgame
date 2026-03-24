import { describe, it, expect } from 'vitest';
import {
	buildDailyReminderPayload,
	buildStreakWarningPayload,
	isStreakAtRisk,
	serializePushPayload,
	type PushPayload
} from './pushNotifications.js';

// ---------------------------------------------------------------------------
// buildDailyReminderPayload
// ---------------------------------------------------------------------------

describe('buildDailyReminderPayload', () => {
	it('returns the correct title', () => {
		const payload = buildDailyReminderPayload();
		expect(payload.title).toBe('Your Daily Forge is ready! 🔥');
	});

	it('returns a non-empty body', () => {
		const payload = buildDailyReminderPayload();
		expect(payload.body.length).toBeGreaterThan(0);
	});

	it('uses the daily-reminder tag', () => {
		const payload = buildDailyReminderPayload();
		expect(payload.tag).toBe('daily-reminder');
	});

	it('includes icon and badge paths', () => {
		const payload = buildDailyReminderPayload();
		expect(payload.icon).toBeTruthy();
		expect(payload.badge).toBeTruthy();
	});

	it('includes data with url and type', () => {
		const payload = buildDailyReminderPayload();
		expect(payload.data?.url).toBe('/');
		expect(payload.data?.type).toBe('daily-reminder');
	});
});

// ---------------------------------------------------------------------------
// buildStreakWarningPayload
// ---------------------------------------------------------------------------

describe('buildStreakWarningPayload', () => {
	it('returns the correct title', () => {
		const payload = buildStreakWarningPayload(5);
		expect(payload.title).toBe('Your streak is at risk! ⚠️');
	});

	it('uses the streak-warning tag', () => {
		const payload = buildStreakWarningPayload(5);
		expect(payload.tag).toBe('streak-warning');
	});

	it('includes streak count in body when streakDays > 0', () => {
		const payload = buildStreakWarningPayload(7);
		expect(payload.body).toContain('7');
		expect(payload.body).toContain('streak');
	});

	it('uses generic message when streakDays is 0', () => {
		const payload = buildStreakWarningPayload(0);
		expect(payload.body).not.toContain('0-day');
		expect(payload.body.toLowerCase()).toContain('streak');
	});

	it('includes data with type and streakDays', () => {
		const payload = buildStreakWarningPayload(3);
		expect(payload.data?.type).toBe('streak-warning');
		expect(payload.data?.streakDays).toBe(3);
	});

	it('includes icon and badge paths', () => {
		const payload = buildStreakWarningPayload(1);
		expect(payload.icon).toBeTruthy();
		expect(payload.badge).toBeTruthy();
	});
});

// ---------------------------------------------------------------------------
// isStreakAtRisk
// ---------------------------------------------------------------------------

describe('isStreakAtRisk', () => {
	it('returns false when lastPlayedDate is null (no streak)', () => {
		expect(isStreakAtRisk(null, '2026-03-24')).toBe(false);
	});

	it('returns false when already played today', () => {
		expect(isStreakAtRisk('2026-03-24', '2026-03-24')).toBe(false);
	});

	it('returns true when last played yesterday', () => {
		expect(isStreakAtRisk('2026-03-23', '2026-03-24')).toBe(true);
	});

	it('returns false when last played 2+ days ago (streak already broken)', () => {
		expect(isStreakAtRisk('2026-03-20', '2026-03-24')).toBe(false);
		expect(isStreakAtRisk('2026-03-22', '2026-03-24')).toBe(false);
	});

	it('handles month boundaries correctly', () => {
		// Jan 31 → Feb 1 is 1 day diff
		expect(isStreakAtRisk('2026-01-31', '2026-02-01')).toBe(true);
	});

	it('handles year boundaries correctly', () => {
		// Dec 31 → Jan 1 is 1 day diff
		expect(isStreakAtRisk('2025-12-31', '2026-01-01')).toBe(true);
	});

	it('returns false when lastPlayedDate is in the future relative to today', () => {
		// Clock skew — last played is after today
		expect(isStreakAtRisk('2026-03-25', '2026-03-24')).toBe(false);
	});
});

// ---------------------------------------------------------------------------
// serializePushPayload
// ---------------------------------------------------------------------------

describe('serializePushPayload', () => {
	it('serializes payload to a JSON string', () => {
		const payload: PushPayload = {
			title: 'Test',
			body: 'Body text',
			icon: '/icon.png',
			badge: '/badge.png',
			tag: 'test-tag'
		};
		const serialized = serializePushPayload(payload);
		const parsed = JSON.parse(serialized) as PushPayload;
		expect(parsed.title).toBe('Test');
		expect(parsed.body).toBe('Body text');
		expect(parsed.tag).toBe('test-tag');
	});

	it('round-trips data field', () => {
		const payload: PushPayload = {
			title: 'T',
			body: 'B',
			icon: '/i',
			badge: '/b',
			tag: 't',
			data: { url: '/', type: 'daily-reminder' }
		};
		const parsed = JSON.parse(serializePushPayload(payload)) as PushPayload;
		expect(parsed.data?.url).toBe('/');
	});
});

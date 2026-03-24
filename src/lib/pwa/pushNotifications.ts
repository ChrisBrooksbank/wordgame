/**
 * Push notification payload builders and streak-risk detection.
 *
 * Pure logic — no Cloudflare APIs. Used by the Cloudflare Worker and unit tests.
 */

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface PushPayload {
	title: string;
	body: string;
	icon: string;
	badge: string;
	tag: string;
	data?: Record<string, unknown>;
}

export interface PushSubscriptionKeys {
	/** Base64url-encoded P-256 ECDH public key (client). */
	p256dh: string;
	/** Base64url-encoded 16-byte authentication secret. */
	auth: string;
}

export interface StoredPushSubscription {
	/** The push service endpoint URL. */
	endpoint: string;
	keys: PushSubscriptionKeys;
	/** ISO date string when subscription was created. */
	createdAt: string;
	/** UTC date of last puzzle played (YYYY-MM-DD), or null if never. */
	lastPlayedDate: string | null;
	/** Current streak count. */
	streakCount: number;
}

// ---------------------------------------------------------------------------
// Payload builders
// ---------------------------------------------------------------------------

/** Build the daily reminder notification payload. */
export function buildDailyReminderPayload(): PushPayload {
	return {
		title: 'Your Daily Forge is ready! 🔥',
		body: 'A new word puzzle is waiting. Keep your streak alive!',
		icon: '/icons/icon-192x192.png',
		badge: '/icons/badge-72x72.png',
		tag: 'daily-reminder',
		data: { url: '/', type: 'daily-reminder' }
	};
}

/** Build the streak-warning notification payload. */
export function buildStreakWarningPayload(streakDays: number): PushPayload {
	const body =
		streakDays > 0
			? `Don't break your ${streakDays}-day streak! Play today to keep it alive.`
			: "Play today's Daily Forge to start a new streak!";
	return {
		title: 'Your streak is at risk! ⚠️',
		body,
		icon: '/icons/icon-192x192.png',
		badge: '/icons/badge-72x72.png',
		tag: 'streak-warning',
		data: { url: '/', type: 'streak-warning', streakDays }
	};
}

// ---------------------------------------------------------------------------
// Streak risk detection
// ---------------------------------------------------------------------------

/**
 * Returns true if the player's streak is at risk.
 *
 * A streak is at risk when the last played date was exactly yesterday —
 * meaning the player has an active streak but hasn't played yet today.
 *
 * @param lastPlayedDate - YYYY-MM-DD string of the last puzzle completed, or null
 * @param today - YYYY-MM-DD string for the current UTC date
 */
export function isStreakAtRisk(lastPlayedDate: string | null, today: string): boolean {
	if (!lastPlayedDate) return false;

	const parse = (d: string): number => {
		const [y, m, day] = d.split('-').map(Number);
		return Date.UTC(y, m - 1, day);
	};

	const diffDays = Math.round((parse(today) - parse(lastPlayedDate)) / 86_400_000);
	// diffDays === 1 means last played yesterday; haven't played today yet
	return diffDays === 1;
}

// ---------------------------------------------------------------------------
// Serialization
// ---------------------------------------------------------------------------

/** Serialize a push payload to a JSON string for the Web Push body. */
export function serializePushPayload(payload: PushPayload): string {
	return JSON.stringify(payload);
}

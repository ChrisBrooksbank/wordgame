/**
 * Push notification opt-in flow for the frontend.
 *
 * Handles:
 *   - Permission request
 *   - PushManager subscription via service worker
 *   - Registration with the Cloudflare Worker KV store
 *   - Local opt-in state persistence (subscribed / dismissed)
 */

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface PushOptInState {
	/** Whether the user has successfully subscribed. */
	subscribed: boolean;
	/** Timestamp when the user last dismissed the opt-in prompt, or null. */
	dismissedAt: number | null;
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const LOCAL_STATE_KEY = 'lexicon-forge:push-opt-in';
/** 30-day cooldown after dismissal before re-showing the prompt. */
const DISMISS_COOLDOWN_MS = 30 * 24 * 60 * 60 * 1000;

const DEFAULT_STATE: PushOptInState = {
	subscribed: false,
	dismissedAt: null
};

// ---------------------------------------------------------------------------
// Feature detection
// ---------------------------------------------------------------------------

/** Returns true if the Push API is available in this browser. */
export function isPushSupported(): boolean {
	return (
		typeof window !== 'undefined' &&
		'serviceWorker' in navigator &&
		'PushManager' in window &&
		'Notification' in window
	);
}

/** Returns the current Notification permission, or 'unsupported' in non-browser envs. */
export function getNotificationPermission(): NotificationPermission | 'unsupported' {
	if (typeof Notification === 'undefined') return 'unsupported';
	return Notification.permission;
}

// ---------------------------------------------------------------------------
// Local state (localStorage)
// ---------------------------------------------------------------------------

/** Load push opt-in state from localStorage. Returns default state on error. */
export function loadPushOptInState(): PushOptInState {
	if (typeof localStorage === 'undefined') return { ...DEFAULT_STATE };
	try {
		const raw = localStorage.getItem(LOCAL_STATE_KEY);
		if (!raw) return { ...DEFAULT_STATE };
		return { ...DEFAULT_STATE, ...(JSON.parse(raw) as Partial<PushOptInState>) };
	} catch {
		return { ...DEFAULT_STATE };
	}
}

/** Persist push opt-in state to localStorage. No-op in non-browser environments. */
export function savePushOptInState(state: PushOptInState): void {
	if (typeof localStorage === 'undefined') return;
	try {
		localStorage.setItem(LOCAL_STATE_KEY, JSON.stringify(state));
	} catch {
		// Storage unavailable — ignore
	}
}

/** Mark the opt-in prompt as dismissed (now). Returns updated state. */
export function dismissPushOptIn(): PushOptInState {
	const state = loadPushOptInState();
	const updated = { ...state, dismissedAt: Date.now() };
	savePushOptInState(updated);
	return updated;
}

// ---------------------------------------------------------------------------
// Display decision
// ---------------------------------------------------------------------------

/**
 * Returns true if the push opt-in prompt should be shown.
 *
 * @param state - current opt-in state
 * @param permission - current Notification permission (pass 'unsupported' if unavailable)
 * @param now - current timestamp (default: Date.now())
 */
export function shouldShowPushOptIn(
	state: PushOptInState,
	permission: NotificationPermission | 'unsupported',
	now: number = Date.now()
): boolean {
	if (state.subscribed) return false;
	if (permission === 'denied' || permission === 'unsupported') return false;
	if (state.dismissedAt !== null && now - state.dismissedAt < DISMISS_COOLDOWN_MS) return false;
	return true;
}

// ---------------------------------------------------------------------------
// Utilities
// ---------------------------------------------------------------------------

/**
 * Convert a Base64url string to a Uint8Array.
 * Used to convert the VAPID public key into the format expected by PushManager.subscribe().
 */
export function urlBase64ToUint8Array(base64String: string): Uint8Array {
	const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
	const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
	const raw = atob(base64);
	const output = new Uint8Array(raw.length);
	for (let i = 0; i < raw.length; i++) {
		output[i] = raw.charCodeAt(i);
	}
	return output;
}

/** Fetch the VAPID public key from the Cloudflare Worker. */
export async function fetchVapidPublicKey(workerUrl: string): Promise<string> {
	const response = await fetch(`${workerUrl}/api/push/vapid-public-key`);
	if (!response.ok) {
		throw new Error(`Failed to fetch VAPID key: ${response.status}`);
	}
	const data = (await response.json()) as { key: string };
	return data.key;
}

// ---------------------------------------------------------------------------
// Subscribe / unsubscribe
// ---------------------------------------------------------------------------

/**
 * Request notification permission, subscribe via the browser Push API,
 * and register the subscription with the Cloudflare Worker.
 *
 * @param workerUrl - base URL of the Cloudflare Worker (e.g. https://…workers.dev)
 * @returns true if successfully subscribed, false if permission was denied
 */
export async function subscribeToNotifications(workerUrl: string): Promise<boolean> {
	if (!isPushSupported()) return false;

	const permission = await Notification.requestPermission();
	if (permission !== 'granted') return false;

	const registration = await navigator.serviceWorker.ready;
	const vapidKey = await fetchVapidPublicKey(workerUrl);
	const applicationServerKey = urlBase64ToUint8Array(vapidKey);

	// Slice produces a plain ArrayBuffer (not SharedArrayBuffer), satisfying the type constraint
	const serverKey = applicationServerKey.buffer.slice(
		applicationServerKey.byteOffset,
		applicationServerKey.byteOffset + applicationServerKey.byteLength
	) as ArrayBuffer;

	const subscription = await registration.pushManager.subscribe({
		userVisibleOnly: true,
		applicationServerKey: serverKey
	});

	const subJson = subscription.toJSON();
	const payload = {
		endpoint: subJson.endpoint,
		keys: subJson.keys
	};

	const response = await fetch(`${workerUrl}/api/push/subscribe`, {
		method: 'POST',
		headers: { 'Content-Type': 'application/json' },
		body: JSON.stringify(payload)
	});

	if (!response.ok) {
		throw new Error(`Failed to register push subscription: ${response.status}`);
	}

	const state = loadPushOptInState();
	savePushOptInState({ ...state, subscribed: true });

	return true;
}

/**
 * Unsubscribe from push notifications and deregister from the Cloudflare Worker.
 *
 * @param workerUrl - base URL of the Cloudflare Worker
 */
export async function unsubscribeFromNotifications(workerUrl: string): Promise<void> {
	if (!isPushSupported()) return;

	const registration = await navigator.serviceWorker.ready;
	const subscription = await registration.pushManager.getSubscription();

	if (subscription) {
		await fetch(`${workerUrl}/api/push/unsubscribe`, {
			method: 'DELETE',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({ endpoint: subscription.endpoint })
		});
		await subscription.unsubscribe();
	}

	const state = loadPushOptInState();
	savePushOptInState({ ...state, subscribed: false });
}

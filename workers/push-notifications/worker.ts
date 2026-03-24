/**
 * Cloudflare Worker: Push Notification Delivery
 *
 * Endpoints:
 *   POST   /api/push/subscribe        — store a push subscription in KV
 *   DELETE /api/push/unsubscribe      — remove a push subscription from KV
 *   GET    /api/push/vapid-public-key — return the VAPID public key
 *
 * Cron triggers (configured in wrangler.toml):
 *   "0 9 * * *"  — daily reminder (9 AM UTC)
 *   "0 19 * * *" — streak warning (7 PM UTC)
 *
 * Secrets (set via `wrangler secret put`):
 *   VAPID_PRIVATE_KEY_JWK — JSON string of the P-256 private key in JWK format
 *   VAPID_PUBLIC_KEY      — Base64url-encoded uncompressed P-256 public key (65 bytes)
 *   VAPID_SUBJECT         — mailto: or https: contact URI
 *
 * KV namespace (configured in wrangler.toml):
 *   PUSH_SUBSCRIPTIONS    — stores StoredPushSubscription values keyed by endpoint hash
 */

import {
	buildDailyReminderPayload,
	buildStreakWarningPayload,
	isStreakAtRisk,
	serializePushPayload,
	type StoredPushSubscription
} from '../../src/lib/pwa/pushNotifications.js';

// ---------------------------------------------------------------------------
// Cloudflare Worker environment bindings
// ---------------------------------------------------------------------------

export interface Env {
	PUSH_SUBSCRIPTIONS: KVNamespace;
	VAPID_PRIVATE_KEY_JWK: string;
	VAPID_PUBLIC_KEY: string;
	VAPID_SUBJECT: string;
}

// ---------------------------------------------------------------------------
// Worker export
// ---------------------------------------------------------------------------

export default {
	async fetch(request: Request, env: Env): Promise<Response> {
		return handleRequest(request, env);
	},

	async scheduled(event: ScheduledEvent, env: Env, ctx: ExecutionContext): Promise<void> {
		if (event.cron === '0 9 * * *') {
			ctx.waitUntil(sendDailyReminders(env));
		} else if (event.cron === '0 19 * * *') {
			ctx.waitUntil(sendStreakWarnings(env));
		}
	}
};

// ---------------------------------------------------------------------------
// HTTP route handlers
// ---------------------------------------------------------------------------

async function handleRequest(request: Request, env: Env): Promise<Response> {
	const url = new URL(request.url);
	const { method } = request;

	if (method === 'OPTIONS') {
		return corsResponse(new Response(null, { status: 204 }));
	}

	if (method === 'GET' && url.pathname === '/api/push/vapid-public-key') {
		return corsResponse(
			new Response(JSON.stringify({ key: env.VAPID_PUBLIC_KEY }), {
				headers: { 'Content-Type': 'application/json' }
			})
		);
	}

	if (method === 'POST' && url.pathname === '/api/push/subscribe') {
		return corsResponse(await handleSubscribe(request, env));
	}

	if (method === 'DELETE' && url.pathname === '/api/push/unsubscribe') {
		return corsResponse(await handleUnsubscribe(request, env));
	}

	return corsResponse(new Response('Not Found', { status: 404 }));
}

async function handleSubscribe(request: Request, env: Env): Promise<Response> {
	let body: unknown;
	try {
		body = await request.json();
	} catch {
		return new Response('Invalid JSON', { status: 400 });
	}

	const sub = body as Partial<StoredPushSubscription>;
	if (!sub.endpoint || !sub.keys?.p256dh || !sub.keys?.auth) {
		return new Response('Missing required fields: endpoint, keys.p256dh, keys.auth', {
			status: 400
		});
	}

	const stored: StoredPushSubscription = {
		endpoint: sub.endpoint,
		keys: sub.keys,
		createdAt: new Date().toISOString(),
		lastPlayedDate: sub.lastPlayedDate ?? null,
		streakCount: sub.streakCount ?? 0
	};

	const key = await endpointKey(sub.endpoint);
	await env.PUSH_SUBSCRIPTIONS.put(key, JSON.stringify(stored));

	return new Response(JSON.stringify({ ok: true }), {
		status: 201,
		headers: { 'Content-Type': 'application/json' }
	});
}

async function handleUnsubscribe(request: Request, env: Env): Promise<Response> {
	let body: unknown;
	try {
		body = await request.json();
	} catch {
		return new Response('Invalid JSON', { status: 400 });
	}

	const { endpoint } = body as { endpoint?: string };
	if (!endpoint) {
		return new Response('Missing required field: endpoint', { status: 400 });
	}

	const key = await endpointKey(endpoint);
	await env.PUSH_SUBSCRIPTIONS.delete(key);

	return new Response(JSON.stringify({ ok: true }), {
		headers: { 'Content-Type': 'application/json' }
	});
}

// ---------------------------------------------------------------------------
// Cron handlers
// ---------------------------------------------------------------------------

async function sendDailyReminders(env: Env): Promise<void> {
	const payload = buildDailyReminderPayload();
	const payloadJson = serializePushPayload(payload);
	const subscriptions = await listAllSubscriptions(env);

	await Promise.allSettled(subscriptions.map((sub) => sendPushNotification(sub, payloadJson, env)));
}

async function sendStreakWarnings(env: Env): Promise<void> {
	const today = utcDateString(new Date());
	const subscriptions = await listAllSubscriptions(env);

	await Promise.allSettled(
		subscriptions
			.filter((sub) => isStreakAtRisk(sub.lastPlayedDate, today))
			.map((sub) => {
				const payload = buildStreakWarningPayload(sub.streakCount);
				return sendPushNotification(sub, serializePushPayload(payload), env);
			})
	);
}

// ---------------------------------------------------------------------------
// KV helpers
// ---------------------------------------------------------------------------

async function listAllSubscriptions(env: Env): Promise<StoredPushSubscription[]> {
	const list = await env.PUSH_SUBSCRIPTIONS.list();
	const results = await Promise.allSettled(
		list.keys.map(async (k) => {
			const raw = await env.PUSH_SUBSCRIPTIONS.get(k.name);
			if (!raw) return null;
			return JSON.parse(raw) as StoredPushSubscription;
		})
	);
	return results
		.filter(
			(r): r is PromiseFulfilledResult<StoredPushSubscription> =>
				r.status === 'fulfilled' && r.value !== null
		)
		.map((r) => r.value);
}

/** Derive a stable KV key from the push endpoint URL using SHA-256. */
async function endpointKey(endpoint: string): Promise<string> {
	const data = new TextEncoder().encode(endpoint);
	const hashBuffer = await crypto.subtle.digest('SHA-256', data);
	return base64UrlEncodeBuffer(new Uint8Array(hashBuffer));
}

// ---------------------------------------------------------------------------
// Web Push (RFC 8291 + VAPID) delivery
// ---------------------------------------------------------------------------

async function sendPushNotification(
	subscription: StoredPushSubscription,
	payloadJson: string,
	env: Env
): Promise<void> {
	const privateKeyJwk = JSON.parse(env.VAPID_PRIVATE_KEY_JWK) as JsonWebKey;
	const audience = new URL(subscription.endpoint).origin;

	const jwt = await signVapidJwt(privateKeyJwk, audience, env.VAPID_SUBJECT);
	const { body, headers } = await encryptWebPush(payloadJson, subscription);

	const response = await fetch(subscription.endpoint, {
		method: 'POST',
		headers: {
			...headers,
			Authorization: `vapid t=${jwt},k=${env.VAPID_PUBLIC_KEY}`,
			'Content-Length': body.byteLength.toString(),
			TTL: '86400'
		},
		body
	});

	if (!response.ok && response.status !== 201) {
		// 410 Gone or 404 means the subscription is no longer valid
		if (response.status === 410 || response.status === 404) {
			const key = await endpointKey(subscription.endpoint);
			// Fire-and-forget cleanup (best effort)
			void fetch(`https://internal/cleanup/${key}`);
		}
		throw new Error(`Push delivery failed: ${response.status} ${response.statusText}`);
	}
}

// ---------------------------------------------------------------------------
// VAPID JWT signing (ES256)
// ---------------------------------------------------------------------------

async function signVapidJwt(
	privateKeyJwk: JsonWebKey,
	audience: string,
	subject: string
): Promise<string> {
	const header = base64UrlEncode(JSON.stringify({ typ: 'JWT', alg: 'ES256' }));
	const now = Math.floor(Date.now() / 1000);
	const claims = { aud: audience, exp: now + 12 * 60 * 60, sub: subject };
	const payload = base64UrlEncode(JSON.stringify(claims));
	const input = `${header}.${payload}`;

	const privateKey = await crypto.subtle.importKey(
		'jwk',
		privateKeyJwk,
		{ name: 'ECDSA', namedCurve: 'P-256' },
		false,
		['sign']
	);

	const signature = await crypto.subtle.sign(
		{ name: 'ECDSA', hash: 'SHA-256' },
		privateKey,
		new TextEncoder().encode(input)
	);

	return `${input}.${base64UrlEncodeBuffer(new Uint8Array(signature))}`;
}

// ---------------------------------------------------------------------------
// RFC 8291: Web Push Message Encryption (aes128gcm content-encoding)
// ---------------------------------------------------------------------------

async function encryptWebPush(
	plaintext: string,
	subscription: StoredPushSubscription
): Promise<{ body: Uint8Array; headers: Record<string, string> }> {
	const plaintextBytes = new TextEncoder().encode(plaintext);

	// Decode client subscription keys
	const clientPublicKeyBytes = base64UrlDecode(subscription.keys.p256dh);
	const authBytes = base64UrlDecode(subscription.keys.auth);

	// Generate server ephemeral key pair (dh)
	const serverKeyPair = await crypto.subtle.generateKey(
		{ name: 'ECDH', namedCurve: 'P-256' },
		true,
		['deriveBits']
	);
	const serverPublicKeyRaw = new Uint8Array(
		await crypto.subtle.exportKey('raw', serverKeyPair.publicKey)
	);

	// Random 16-byte salt
	const salt = crypto.getRandomValues(new Uint8Array(16));

	// Import client public key for ECDH
	const clientPublicKey = await crypto.subtle.importKey(
		'raw',
		clientPublicKeyBytes,
		{ name: 'ECDH', namedCurve: 'P-256' },
		false,
		[]
	);

	// ECDH: derive shared secret (IKM)
	const ecdhSecret = new Uint8Array(
		await crypto.subtle.deriveBits(
			{ name: 'ECDH', public: clientPublicKey },
			serverKeyPair.privateKey,
			256
		)
	);

	// RFC 8291 §3.1: Two-stage HKDF key derivation
	// Stage 1: PRK_key = HKDF-Extract(salt=auth_secret, IKM=ecdh_secret)
	const prkKey = await hkdfExtract(authBytes, ecdhSecret);

	// Stage 1 expansion: key_info = "WebPush: info\0" || ua_public || as_public
	const keyInfo = concat(
		new TextEncoder().encode('WebPush: info\x00'),
		clientPublicKeyBytes,
		serverPublicKeyRaw
	);
	const ikm = await hkdfExpand(prkKey, keyInfo, 32);

	// Stage 2: PRK = HKDF-Extract(salt=salt, IKM=ikm)
	const prk = await hkdfExtract(salt, ikm);

	// Derive CEK (16 bytes) and nonce (12 bytes)
	const cekInfo = new TextEncoder().encode('Content-Encoding: aes128gcm\x00');
	const nonceInfo = new TextEncoder().encode('Content-Encoding: nonce\x00');
	const cek = await hkdfExpand(prk, cekInfo, 16);
	const nonce = await hkdfExpand(prk, nonceInfo, 12);

	// Pad record: plaintext || 0x02 (last-record delimiter)
	const record = new Uint8Array(plaintextBytes.length + 1);
	record.set(plaintextBytes);
	record[plaintextBytes.length] = 0x02;

	// Encrypt with AES-128-GCM
	const aesKey = await crypto.subtle.importKey('raw', cek, { name: 'AES-GCM' }, false, ['encrypt']);
	const ciphertext = new Uint8Array(
		await crypto.subtle.encrypt({ name: 'AES-GCM', iv: nonce }, aesKey, record)
	);

	// RFC 8188 §2.1 header: salt(16) + rs(4 uint32 big-endian) + idlen(1) + server_public_key(65)
	const rs = 4096;
	const headerLen = 16 + 4 + 1 + serverPublicKeyRaw.length;
	const header = new Uint8Array(headerLen);
	let off = 0;
	header.set(salt, off);
	off += 16;
	header[off++] = (rs >>> 24) & 0xff;
	header[off++] = (rs >>> 16) & 0xff;
	header[off++] = (rs >>> 8) & 0xff;
	header[off++] = rs & 0xff;
	header[off++] = serverPublicKeyRaw.length;
	header.set(serverPublicKeyRaw, off);

	const body = concat(header, ciphertext);

	return {
		body,
		headers: {
			'Content-Type': 'application/octet-stream',
			'Content-Encoding': 'aes128gcm'
		}
	};
}

// ---------------------------------------------------------------------------
// HKDF helpers (Web Crypto)
// ---------------------------------------------------------------------------

/** HKDF-Extract using HMAC-SHA-256. Returns the PRK as a raw Uint8Array. */
async function hkdfExtract(salt: Uint8Array, ikm: Uint8Array): Promise<Uint8Array> {
	const key = await crypto.subtle.importKey('raw', salt, { name: 'HMAC', hash: 'SHA-256' }, false, [
		'sign'
	]);
	return new Uint8Array(await crypto.subtle.sign('HMAC', key, ikm));
}

/** HKDF-Expand using HMAC-SHA-256. Returns `length` output bytes. */
async function hkdfExpand(prk: Uint8Array, info: Uint8Array, length: number): Promise<Uint8Array> {
	const key = await crypto.subtle.importKey('raw', prk, { name: 'HMAC', hash: 'SHA-256' }, false, [
		'sign'
	]);
	const blocks = Math.ceil(length / 32);
	const result = new Uint8Array(blocks * 32);
	let prev = new Uint8Array(0);

	for (let i = 0; i < blocks; i++) {
		const input = concat(prev, info, new Uint8Array([i + 1]));
		prev = new Uint8Array(await crypto.subtle.sign('HMAC', key, input));
		result.set(prev, i * 32);
	}

	return result.slice(0, length);
}

// ---------------------------------------------------------------------------
// Base64url & buffer utilities
// ---------------------------------------------------------------------------

function base64UrlEncode(str: string): string {
	return base64UrlEncodeBuffer(new TextEncoder().encode(str));
}

function base64UrlEncodeBuffer(buf: Uint8Array): string {
	let binary = '';
	for (const byte of buf) binary += String.fromCharCode(byte);
	return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function base64UrlDecode(str: string): Uint8Array {
	const base64 = str.replace(/-/g, '+').replace(/_/g, '/');
	const binary = atob(base64);
	const bytes = new Uint8Array(binary.length);
	for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
	return bytes;
}

/** Concatenate multiple Uint8Arrays into one. */
function concat(...arrays: Uint8Array[]): Uint8Array {
	const total = arrays.reduce((n, a) => n + a.length, 0);
	const result = new Uint8Array(total);
	let offset = 0;
	for (const arr of arrays) {
		result.set(arr, offset);
		offset += arr.length;
	}
	return result;
}

/** Format a Date as a UTC YYYY-MM-DD string. */
function utcDateString(date: Date): string {
	return date.toISOString().slice(0, 10);
}

/** Add CORS headers to a response. */
function corsResponse(response: Response): Response {
	const headers = new Headers(response.headers);
	headers.set('Access-Control-Allow-Origin', '*');
	headers.set('Access-Control-Allow-Methods', 'GET, POST, DELETE, OPTIONS');
	headers.set('Access-Control-Allow-Headers', 'Content-Type');
	return new Response(response.body, {
		status: response.status,
		statusText: response.statusText,
		headers
	});
}

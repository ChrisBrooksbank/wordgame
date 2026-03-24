/**
 * Service worker registration utility.
 * Uses the Workbox-generated service worker via vite-plugin-pwa.
 */

export interface ServiceWorkerState {
	registered: boolean;
	updateAvailable: boolean;
}

/**
 * Register the service worker. Returns null in non-browser environments.
 * The actual registration is handled by vite-plugin-pwa's injectRegister: 'script'.
 * This module provides state tracking on top.
 */
export function getServiceWorkerSupport(): boolean {
	return typeof navigator !== 'undefined' && 'serviceWorker' in navigator;
}

/**
 * Triggers a skipWaiting message to activate a waiting service worker immediately.
 */
export async function skipWaiting(): Promise<void> {
	if (!getServiceWorkerSupport()) return;
	const registration = await navigator.serviceWorker.getRegistration();
	if (registration?.waiting) {
		registration.waiting.postMessage({ type: 'SKIP_WAITING' });
	}
}

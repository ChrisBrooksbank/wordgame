/**
 * Network status store for online/offline detection.
 * Uses browser navigator.onLine and online/offline events.
 */

import { readable } from 'svelte/store';

/** Returns the current online status from navigator, defaulting to true in non-browser environments. */
export function getOnlineStatus(): boolean {
	if (typeof navigator === 'undefined') return true;
	// navigator.onLine may be undefined in some environments (e.g. Node.js/vitest)
	return navigator.onLine !== false;
}

/**
 * A readable Svelte store that tracks browser online/offline status.
 * Updates automatically via window online/offline events.
 * Always true in SSR (non-browser) context.
 */
export const isOnline = readable<boolean>(getOnlineStatus(), (set) => {
	if (typeof window === 'undefined') return;

	const handleOnline = () => set(true);
	const handleOffline = () => set(false);

	window.addEventListener('online', handleOnline);
	window.addEventListener('offline', handleOffline);

	return () => {
		window.removeEventListener('online', handleOnline);
		window.removeEventListener('offline', handleOffline);
	};
});

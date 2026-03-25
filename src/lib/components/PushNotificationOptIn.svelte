<script lang="ts">
	import { onMount } from 'svelte';
	import {
		shouldShowPushOptIn,
		loadPushOptInState,
		dismissPushOptIn,
		subscribeToNotifications,
		getNotificationPermission,
		isPushSupported
	} from '$lib/pwa/pushSubscription.js';

	interface Props {
		/** Base URL of the Cloudflare Worker (e.g. https://….workers.dev). */
		workerUrl: string;
	}

	let { workerUrl }: Props = $props();

	let visible = $state(false);
	let loading = $state(false);
	let subscribed = $state(false);

	onMount(() => {
		if (!isPushSupported()) return;

		const state = loadPushOptInState();
		const permission = getNotificationPermission();

		if (shouldShowPushOptIn(state, permission)) {
			visible = true;
		}
	});

	async function handleEnable() {
		if (loading) return;
		loading = true;

		try {
			const result = await subscribeToNotifications(workerUrl);
			if (result) {
				subscribed = true;
				visible = false;
			} else {
				// Permission denied — hide prompt
				visible = false;
			}
		} catch {
			// Subscription failed — hide silently, don't block the user
			visible = false;
		} finally {
			loading = false;
		}
	}

	function handleDismiss() {
		dismissPushOptIn();
		visible = false;
	}
</script>

{#if subscribed}
	<div
		class="flex items-center gap-2 rounded-lg border border-green-800 bg-green-950 px-4 py-3 text-sm text-green-400"
	>
		<span>🔔</span>
		<span>Daily reminders enabled!</span>
	</div>
{:else if visible}
	<div
		role="dialog"
		aria-modal="false"
		aria-label="Enable daily reminders"
		class="w-full rounded-xl border border-gray-700 bg-gray-900 p-4"
	>
		<div class="flex items-start gap-3">
			<span class="mt-0.5 text-xl" aria-hidden="true">🔔</span>
			<div class="flex-1">
				<p class="text-sm font-semibold text-gray-100">Never miss a Daily Forge</p>
				<p class="mt-1 text-xs text-gray-400">
					Get a daily reminder when your puzzle is ready, and streak alerts before you lose your
					progress.
				</p>
			</div>
			<button
				onclick={handleDismiss}
				aria-label="Dismiss notification prompt"
				class="mt-0.5 flex-shrink-0 text-gray-500 transition-colors hover:text-gray-300"
			>
				✕
			</button>
		</div>

		<div class="mt-3 flex gap-2">
			<button
				onclick={handleDismiss}
				class="flex-1 rounded-lg border border-gray-700 py-2 text-xs text-gray-400 transition-colors hover:border-gray-500 hover:text-gray-200"
			>
				Not now
			</button>
			<button
				onclick={handleEnable}
				disabled={loading}
				class="flex-1 rounded-lg bg-forge-orange py-2 text-xs font-bold text-gray-900 transition-opacity hover:opacity-90 disabled:opacity-60"
			>
				{loading ? 'Enabling…' : 'Enable reminders'}
			</button>
		</div>
	</div>
{/if}

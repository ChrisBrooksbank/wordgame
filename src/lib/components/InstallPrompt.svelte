<script lang="ts">
	import { onMount } from 'svelte';
	import {
		incrementSessionCount,
		dismissInstallPrompt,
		shouldShowInstallPrompt,
		isIOS,
		isStandalone
	} from '$lib/pwa/installPrompt.js';

	// BeforeInstallPromptEvent is not in standard TypeScript types
	interface BeforeInstallPromptEvent extends Event {
		prompt(): Promise<void>;
		userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
	}

	let visible = $state(false);
	let ios = $state(false);
	let deferredPrompt = $state<BeforeInstallPromptEvent | null>(null);

	onMount(() => {
		// Already installed — never show
		if (isStandalone()) return;

		ios = isIOS();

		const state = incrementSessionCount();

		if (!shouldShowInstallPrompt(state)) return;

		if (ios) {
			// iOS: show manual instructions immediately (no beforeinstallprompt event)
			visible = true;
			return;
		}

		// Android/Desktop: wait for beforeinstallprompt
		const handleBeforeInstall = (e: Event) => {
			e.preventDefault();
			deferredPrompt = e as BeforeInstallPromptEvent;
			visible = true;
		};

		window.addEventListener('beforeinstallprompt', handleBeforeInstall);

		return () => {
			window.removeEventListener('beforeinstallprompt', handleBeforeInstall);
		};
	});

	async function handleInstall() {
		if (!deferredPrompt) return;
		await deferredPrompt.prompt();
		const { outcome } = await deferredPrompt.userChoice;
		deferredPrompt = null;
		visible = false;
		if (outcome === 'dismissed') {
			dismissInstallPrompt();
		}
	}

	function handleDismiss() {
		visible = false;
		dismissInstallPrompt();
	}
</script>

{#if visible}
	<div
		role="dialog"
		aria-modal="false"
		aria-label="Install Lexicon Forge"
		class="fixed bottom-20 left-1/2 z-50 w-[calc(100%-2rem)] max-w-sm -translate-x-1/2 rounded-xl border border-gray-700 bg-gray-900 p-4 shadow-lg"
	>
		<div class="flex items-start gap-3">
			<div class="flex-1">
				<p class="text-sm font-semibold text-gray-100">Add to Home Screen</p>
				{#if ios}
					<p class="mt-1 text-xs text-gray-400">
						Tap <span class="text-gray-200">Share</span> then
						<span class="text-gray-200">Add to Home Screen</span> to install Lexicon Forge.
					</p>
				{:else}
					<p class="mt-1 text-xs text-gray-400">
						Install Lexicon Forge for a faster, native-like experience.
					</p>
				{/if}
			</div>
			<button
				onclick={handleDismiss}
				aria-label="Dismiss install prompt"
				class="mt-0.5 flex-shrink-0 text-gray-500 hover:text-gray-300 transition-colors"
			>
				✕
			</button>
		</div>

		{#if !ios}
			<div class="mt-3 flex gap-2">
				<button
					onclick={handleDismiss}
					class="flex-1 rounded-lg border border-gray-700 py-2 text-xs text-gray-400 hover:border-gray-500 hover:text-gray-200 transition-colors"
				>
					Not now
				</button>
				<button
					onclick={handleInstall}
					class="flex-1 rounded-lg bg-forge-orange py-2 text-xs font-bold text-gray-900 hover:opacity-90 transition-opacity"
				>
					Install
				</button>
			</div>
		{/if}
	</div>
{/if}

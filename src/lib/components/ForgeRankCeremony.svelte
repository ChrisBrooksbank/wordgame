<script lang="ts">
	import { tierInfoForTier } from '$lib/engine/forgeRank.js';
	import type { ForgeRankTier } from '$lib/engine/forgeRank.js';

	interface Props {
		/** The new tier that was just reached. */
		newTier: ForgeRankTier;
		/** Called when the player dismisses the ceremony screen. */
		ondismiss?: () => void;
	}

	let { newTier, ondismiss }: Props = $props();

	const tierInfo = $derived(tierInfoForTier(newTier));

	let visible = $state(true);

	function dismiss() {
		visible = false;
		ondismiss?.();
	}
</script>

{#if visible}
	<!-- Full-screen overlay -->
	<!-- svelte-ignore a11y_click_events_have_key_events -->
	<!-- svelte-ignore a11y_no_static_element_interactions -->
	<div
		class="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm"
		onclick={dismiss}
		role="dialog"
		aria-modal="true"
		aria-label="Rank up ceremony"
		tabindex="-1"
	>
		<!-- Card — stop propagation so clicking the card doesn't dismiss -->
		<!-- svelte-ignore a11y_click_events_have_key_events -->
		<!-- svelte-ignore a11y_no_static_element_interactions -->
		<div
			class="relative flex max-w-sm flex-col items-center gap-6 rounded-2xl border border-gray-700 bg-gray-900 p-8 text-center shadow-2xl"
			onclick={(e) => e.stopPropagation()}
		>
			<!-- Animated emoji -->
			<div class="animate-bounce text-7xl" aria-hidden="true" style="animation-duration: 1.2s;">
				{tierInfo.emoji}
			</div>

			<div class="flex flex-col gap-2">
				<p class="text-sm font-semibold uppercase tracking-widest text-gray-400">Rank Up!</p>
				<h2 class="text-3xl font-extrabold {tierInfo.colorClass}">
					{newTier}
				</h2>
				<p class="text-sm text-gray-400">
					You've reached a new tier. Keep forging to climb higher!
				</p>
			</div>

			<button
				onclick={dismiss}
				class="rounded-lg bg-forge-orange px-8 py-3 text-sm font-bold text-gray-900 transition-opacity hover:opacity-90"
			>
				Continue
			</button>
		</div>
	</div>
{/if}

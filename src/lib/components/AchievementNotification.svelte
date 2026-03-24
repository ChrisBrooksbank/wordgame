<script lang="ts">
	import {
		ACHIEVEMENT_DEFS,
		resolveAchievementDisplay,
		getRecord
	} from '$lib/engine/achievements.js';
	import type { AchievementStore } from '$lib/engine/achievements.js';

	interface Props {
		/** ID of the achievement that was just unlocked. */
		achievementId: string;
		/** The store, used to look up the unlock record. */
		store: AchievementStore;
		/** Called when the notification is dismissed. */
		ondismiss?: () => void;
	}

	let { achievementId, store, ondismiss }: Props = $props();

	const def = $derived(ACHIEVEMENT_DEFS.find((d) => d.id === achievementId));
	const record = $derived(def ? getRecord(store, def.id) : { id: achievementId, unlockedAt: null });
	const display = $derived(def ? resolveAchievementDisplay(def, record) : null);

	let visible = $state(true);

	function dismiss() {
		visible = false;
		ondismiss?.();
	}
</script>

{#if visible && def && display}
	<!-- Slide-in toast positioned at top-center -->
	<div
		class="fixed left-1/2 top-4 z-50 -translate-x-1/2"
		role="alert"
		aria-live="polite"
		aria-label="Achievement unlocked"
	>
		<div
			class="flex min-w-64 max-w-sm items-center gap-3 rounded-xl border border-amber-600/50 bg-gray-900/95 px-4 py-3 shadow-lg backdrop-blur-sm"
		>
			<!-- Emoji -->
			<div class="flex-shrink-0 text-3xl" aria-hidden="true">
				{display.emoji}
			</div>

			<!-- Text -->
			<div class="flex flex-col gap-0.5">
				<p class="text-xs font-semibold uppercase tracking-widest text-amber-400">
					Achievement Unlocked
				</p>
				<p class="text-sm font-bold text-white">{display.name}</p>
				<p class="text-xs text-gray-400">{display.description}</p>
			</div>

			<!-- Dismiss button -->
			<button
				onclick={dismiss}
				class="ml-auto flex-shrink-0 text-gray-500 transition-colors hover:text-white"
				aria-label="Dismiss"
			>
				✕
			</button>
		</div>
	</div>
{/if}

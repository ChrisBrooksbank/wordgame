<script lang="ts">
	import { computeForgeRank, tierInfoForTier } from '$lib/engine/forgeRank.js';
	import type { ForgeRankTier } from '$lib/engine/forgeRank.js';

	interface Props {
		/** Composite cognitive score. */
		score: number;
		/** Display size variant. */
		size?: 'sm' | 'md' | 'lg';
		/** Show the progress bar toward next tier. */
		showProgress?: boolean;
	}

	let { score, size = 'md', showProgress = false }: Props = $props();

	const rank = $derived(computeForgeRank(score));
	const tierInfo = $derived(tierInfoForTier(rank.tier as ForgeRankTier));

	const sizeClasses: Record<string, string> = {
		sm: 'text-sm px-2 py-0.5',
		md: 'text-base px-3 py-1',
		lg: 'text-xl px-4 py-2'
	};
	const emojiSizes: Record<string, string> = { sm: 'text-base', md: 'text-xl', lg: 'text-3xl' };
</script>

<div class="flex flex-col items-center gap-1">
	<!-- Badge pill -->
	<div
		class="inline-flex items-center gap-1.5 rounded-full border border-current font-bold {sizeClasses[
			size
		]} {tierInfo.colorClass}"
		aria-label="Forge Rank: {rank.tier}"
	>
		<span class={emojiSizes[size]} aria-hidden="true">{tierInfo.emoji}</span>
		<span>{rank.tier}</span>
	</div>

	<!-- Optional progress bar -->
	{#if showProgress && rank.tier !== 'Legendary'}
		<div class="w-full">
			<div class="h-1.5 w-full overflow-hidden rounded-full bg-gray-700">
				<div
					class="h-full rounded-full bg-current transition-all duration-500 {tierInfo.colorClass}"
					style="width: {(rank.tierProgress * 100).toFixed(1)}%"
					role="progressbar"
					aria-valuenow={Math.round(rank.tierProgress * 100)}
					aria-valuemin={0}
					aria-valuemax={100}
					aria-label="Progress to next rank"
				></div>
			</div>
			<p class="mt-0.5 text-center text-xs text-gray-400">
				{rank.pointsToNextTier} pts to next rank
			</p>
		</div>
	{:else if showProgress && rank.tier === 'Legendary'}
		<p class="text-xs font-semibold text-yellow-300">Maximum Rank Achieved!</p>
	{/if}
</div>

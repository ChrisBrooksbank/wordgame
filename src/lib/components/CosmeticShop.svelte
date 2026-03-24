<script lang="ts">
	import {
		BOARD_SKINS,
		TILE_STYLES,
		TRAIL_EFFECTS,
		COSMETIC_UNLOCK_TABLE,
		getBoardSkin,
		equipSkin,
		equipTileStyle,
		equipTrailEffect,
		unlockHint,
		type CosmeticsStore
	} from '$lib/engine/cosmetics.js';

	interface Props {
		store: CosmeticsStore;
		onchange?: (_updated: CosmeticsStore) => void;
	}

	let { store, onchange }: Props = $props();

	type Tab = 'skins' | 'tiles' | 'trails';
	let activeTab: Tab = $state('skins');

	function unlockCondition(category: 'skin' | 'tileStyle' | 'trail', id: string): string {
		const entry = COSMETIC_UNLOCK_TABLE.find((e) => e.category === category && e.id === id);
		return entry ? unlockHint(entry.condition) : '';
	}

	function isUnlocked(category: 'skin' | 'tileStyle' | 'trail', id: string): boolean {
		if (category === 'skin') return store.unlockedSkinIds.includes(id);
		if (category === 'tileStyle') return store.unlockedTileStyleIds.includes(id);
		return store.unlockedTrailEffectIds.includes(id);
	}

	function isEquipped(category: 'skin' | 'tileStyle' | 'trail', id: string): boolean {
		if (category === 'skin') return store.equippedSkinId === id;
		if (category === 'tileStyle') return store.equippedTileStyleId === id;
		return store.equippedTrailEffectId === id;
	}

	function handleEquip(category: 'skin' | 'tileStyle' | 'trail', id: string) {
		if (!isUnlocked(category, id)) return;
		let updated: CosmeticsStore;
		if (category === 'skin') updated = equipSkin(store, id);
		else if (category === 'tileStyle') updated = equipTileStyle(store, id);
		else updated = equipTrailEffect(store, id);
		onchange?.(updated);
	}
</script>

<div class="flex flex-col gap-4">
	<!-- Tab bar -->
	<div class="flex gap-1 rounded-lg bg-gray-800 p-1">
		{#each [{ id: 'skins', label: 'Board Skins', emoji: '🎨' }, { id: 'tiles', label: 'Tile Styles', emoji: '⬡' }, { id: 'trails', label: 'Trail Effects', emoji: '✨' }] as tab}
			<button
				class="flex flex-1 items-center justify-center gap-1 rounded-md px-3 py-2 text-sm font-medium transition-colors
					{activeTab === tab.id ? 'bg-orange-500 text-white' : 'text-gray-400 hover:text-gray-200'}"
				onclick={() => (activeTab = tab.id as Tab)}
			>
				<span>{tab.emoji}</span>
				<span class="hidden sm:inline">{tab.label}</span>
			</button>
		{/each}
	</div>

	<!-- Skin grid -->
	{#if activeTab === 'skins'}
		<div class="grid grid-cols-2 gap-3 sm:grid-cols-3">
			{#each BOARD_SKINS as skin}
				{@const unlocked = isUnlocked('skin', skin.id)}
				{@const equipped = isEquipped('skin', skin.id)}
				<button
					class="flex flex-col items-center gap-2 rounded-xl border-2 p-3 transition-all
						{equipped
						? 'border-orange-500 bg-orange-950/40'
						: unlocked
							? 'border-gray-600 bg-gray-800 hover:border-gray-400'
							: 'cursor-not-allowed border-gray-700 bg-gray-900 opacity-60'}"
					onclick={() => handleEquip('skin', skin.id)}
					disabled={!unlocked}
					title={unlocked ? (equipped ? 'Equipped' : 'Equip') : unlockCondition('skin', skin.id)}
				>
					<!-- Mini hex preview -->
					<svg
						width="60"
						height="52"
						viewBox="-32 -28 64 56"
						xmlns="http://www.w3.org/2000/svg"
						aria-hidden="true"
					>
						<!-- Three offset hexagons suggesting a grid -->
						{#each [{ cx: -14, cy: -8 }, { cx: 14, cy: -8 }, { cx: 0, cy: 16 }] as hex, i}
							<polygon
								points="0,-12 10.4,-6 10.4,6 0,12 -10.4,6 -10.4,-6"
								transform="translate({hex.cx},{hex.cy})"
								fill={i === 1 ? skin.colors.tileSelectedFill : skin.colors.tileFill}
								stroke={i === 1 ? skin.colors.tileSelectedStroke : skin.colors.tileStroke}
								stroke-width="1.5"
							/>
						{/each}
					</svg>

					<div class="flex items-center gap-1 text-sm font-semibold text-gray-100">
						<span>{skin.emoji}</span>
						<span>{skin.name}</span>
					</div>

					{#if !unlocked}
						<span class="text-center text-xs text-gray-400">{unlockCondition('skin', skin.id)}</span
						>
					{:else if equipped}
						<span class="text-xs font-medium text-orange-400">Equipped</span>
					{:else}
						<span class="text-xs text-gray-500">Tap to equip</span>
					{/if}
				</button>
			{/each}
		</div>
	{/if}

	<!-- Tile styles grid -->
	{#if activeTab === 'tiles'}
		<div class="grid grid-cols-2 gap-3 sm:grid-cols-3">
			{#each TILE_STYLES as style}
				{@const unlocked = isUnlocked('tileStyle', style.id)}
				{@const equipped = isEquipped('tileStyle', style.id)}
				{@const activeSkin = getBoardSkin(store.equippedSkinId)}
				<button
					class="flex flex-col items-center gap-2 rounded-xl border-2 p-3 transition-all
						{equipped
						? 'border-orange-500 bg-orange-950/40'
						: unlocked
							? 'border-gray-600 bg-gray-800 hover:border-gray-400'
							: 'cursor-not-allowed border-gray-700 bg-gray-900 opacity-60'}"
					onclick={() => handleEquip('tileStyle', style.id)}
					disabled={!unlocked}
					title={unlocked
						? equipped
							? 'Equipped'
							: 'Equip'
						: unlockCondition('tileStyle', style.id)}
				>
					<!-- Single tile preview -->
					<svg
						width="52"
						height="52"
						viewBox="-28 -28 56 56"
						xmlns="http://www.w3.org/2000/svg"
						aria-hidden="true"
					>
						<polygon
							points="0,-20 17.3,-10 17.3,10 0,20 -17.3,10 -17.3,-10"
							fill={activeSkin.colors.tileFill}
							stroke={activeSkin.colors.tileStroke}
							stroke-width={style.strokeWidth}
						/>
						<text
							x="0"
							y="0"
							text-anchor="middle"
							dominant-baseline="central"
							fill={activeSkin.colors.textFill}
							font-size="14"
							font-weight="bold"
							font-family="system-ui, sans-serif">A</text
						>
					</svg>

					<div class="flex items-center gap-1 text-sm font-semibold text-gray-100">
						<span>{style.emoji}</span>
						<span>{style.name}</span>
					</div>

					{#if !unlocked}
						<span class="text-center text-xs text-gray-400"
							>{unlockCondition('tileStyle', style.id)}</span
						>
					{:else if equipped}
						<span class="text-xs font-medium text-orange-400">Equipped</span>
					{:else}
						<span class="text-xs text-gray-500">Tap to equip</span>
					{/if}
				</button>
			{/each}
		</div>
	{/if}

	<!-- Trail effects grid -->
	{#if activeTab === 'trails'}
		<div class="grid grid-cols-2 gap-3 sm:grid-cols-3">
			{#each TRAIL_EFFECTS as trail}
				{@const unlocked = isUnlocked('trail', trail.id)}
				{@const equipped = isEquipped('trail', trail.id)}
				<button
					class="flex flex-col items-center gap-2 rounded-xl border-2 p-3 transition-all
						{equipped
						? 'border-orange-500 bg-orange-950/40'
						: unlocked
							? 'border-gray-600 bg-gray-800 hover:border-gray-400'
							: 'cursor-not-allowed border-gray-700 bg-gray-900 opacity-60'}"
					onclick={() => handleEquip('trail', trail.id)}
					disabled={!unlocked}
					title={unlocked ? (equipped ? 'Equipped' : 'Equip') : unlockCondition('trail', trail.id)}
				>
					<!-- Trail line preview -->
					<svg
						width="80"
						height="40"
						viewBox="0 0 80 40"
						xmlns="http://www.w3.org/2000/svg"
						aria-hidden="true"
					>
						<rect width="80" height="40" fill="#111827" rx="4" />
						<polyline
							points="10,30 30,15 50,25 70,10"
							fill="none"
							stroke={trail.stroke}
							stroke-width={trail.strokeWidth}
							stroke-linecap="round"
							stroke-linejoin="round"
							opacity={trail.opacity}
							stroke-dasharray={trail.strokeDasharray ?? undefined}
						/>
						<!-- End dot -->
						<circle cx="70" cy="10" r="4" fill={trail.stroke} opacity={trail.opacity} />
					</svg>

					<div class="flex items-center gap-1 text-sm font-semibold text-gray-100">
						<span>{trail.emoji}</span>
						<span>{trail.name}</span>
					</div>

					{#if !unlocked}
						<span class="text-center text-xs text-gray-400"
							>{unlockCondition('trail', trail.id)}</span
						>
					{:else if equipped}
						<span class="text-xs font-medium text-orange-400">Equipped</span>
					{:else}
						<span class="text-xs text-gray-500">Tap to equip</span>
					{/if}
				</button>
			{/each}
		</div>
	{/if}
</div>

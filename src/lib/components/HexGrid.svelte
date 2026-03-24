<script lang="ts">
	import type { HexGrid, HexCoord } from '$lib/engine/hexGrid.js';
	import {
		hexToPixel,
		hexCorners,
		hexKey,
		computeGridBounds,
		gridCoords,
		canExtendPath
	} from '$lib/engine/hexGrid.js';

	interface Props {
		grid: HexGrid;
		selectedPath?: HexCoord[];
		tileSize?: number;
		ontileclick?: (_c: HexCoord) => void;
	}

	let { grid, selectedPath = [], tileSize = 40, ontileclick }: Props = $props();

	const coords = $derived(gridCoords(grid.size));

	const bounds = $derived(computeGridBounds(coords, tileSize));

	const viewBox = $derived(`${bounds.minX} ${bounds.minY} ${bounds.width} ${bounds.height}`);

	const renderedTiles = $derived(
		grid.tiles.map((tile) => {
			const center = hexToPixel(tile.coord, tileSize);
			const corners = hexCorners(center, tileSize);
			const points = corners.map((c) => `${c.x},${c.y}`).join(' ');
			const key = hexKey(tile.coord);
			const isSelected = selectedPath.some((c) => hexKey(c) === key);
			const isLast =
				selectedPath.length > 0 && hexKey(selectedPath[selectedPath.length - 1]) === key;
			const canAdd = !isSelected && canExtendPath(selectedPath, tile.coord);
			return { ...tile, center, points, isSelected, isLast, canAdd };
		})
	);

	// Polyline points connecting selected tile centers in order
	const pathLinePoints = $derived(
		selectedPath
			.map((coord) => {
				const center = hexToPixel(coord, tileSize);
				return `${center.x},${center.y}`;
			})
			.join(' ')
	);
</script>

<svg
	class="h-auto w-full"
	{viewBox}
	xmlns="http://www.w3.org/2000/svg"
	role="img"
	aria-label="Hexagonal letter grid"
>
	{#each renderedTiles as tile (tile.id)}
		<g
			role="button"
			tabindex="0"
			aria-label="Tile {tile.letter}"
			aria-pressed={tile.isSelected}
			onclick={() => ontileclick?.(tile.coord)}
			onkeydown={(e) => {
				if (e.key === 'Enter' || e.key === ' ') ontileclick?.(tile.coord);
			}}
			style="cursor: {ontileclick ? 'pointer' : 'default'}"
		>
			<polygon
				points={tile.points}
				fill={tile.isLast ? '#f97316' : tile.isSelected ? '#f59e0b' : '#1f2937'}
				stroke={tile.isSelected ? '#f97316' : tile.canAdd ? '#6b7280' : '#374151'}
				stroke-width={tile.canAdd ? '3' : '2'}
			/>
			<text
				x={tile.center.x}
				y={tile.center.y}
				text-anchor="middle"
				dominant-baseline="central"
				fill={tile.isSelected ? '#1f2937' : '#f3f4f6'}
				font-size={tileSize * 0.45}
				font-weight="bold"
				font-family="system-ui, sans-serif"
			>
				{tile.letter}
			</text>
		</g>
	{/each}

	{#if selectedPath.length >= 2}
		<polyline
			points={pathLinePoints}
			fill="none"
			stroke="#f97316"
			stroke-width="3"
			stroke-linecap="round"
			stroke-linejoin="round"
			opacity="0.7"
			pointer-events="none"
		/>
	{/if}
</svg>

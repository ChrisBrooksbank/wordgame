<script lang="ts">
	const title = 'Lexicon Forge';

	const modes = [
		{ href: '/daily', label: 'Daily Forge', desc: '5×5 · 15 moves · Catalyst letter' },
		{ href: '/rush', label: 'Rush Mode', desc: '4×4 · 90 seconds · Combos' },
		{ href: '/memory', label: 'Memory Crucible', desc: '4×4 · Memorize tiles · 3 strikes' },
		{ href: '/architect', label: 'Architect', desc: 'Rectangular grid · Place fragments' },
		{ href: '/cascade', label: 'Cascade', desc: '5×8 · Auto-forge chains · 20 moves' }
	];
</script>

<svelte:head>
	<title>{title}</title>
</svelte:head>

<main class="flex min-h-screen flex-col items-center justify-center gap-8 px-4 py-12">
	<div class="text-center">
		<h1 class="bg-forge-gradient bg-clip-text text-6xl font-bold text-transparent">{title}</h1>
		<p class="mt-2 text-gray-400">The word forging game</p>
	</div>

	<nav class="flex w-full max-w-sm flex-col gap-3">
		{#each modes as mode}
			<a
				href={mode.href}
				class="flex flex-col rounded-lg border border-gray-800 bg-gray-900 px-5 py-4 transition-colors hover:border-forge-orange hover:bg-gray-800"
			>
				<span class="font-semibold text-gray-100">{mode.label}</span>
				<span class="text-sm text-gray-500">{mode.desc}</span>
			</a>
		{/each}
	</nav>
</main>

<script lang="ts">
	const title = 'Daily Forge';
</script>

<svelte:head>
	<title>{title} — Lexicon Forge</title>
</svelte:head>

<main class="flex min-h-screen flex-col items-center justify-center gap-4">
	<h1 class="bg-forge-gradient bg-clip-text text-5xl font-bold text-transparent">{title}</h1>
	<p class="text-gray-400">5×5 hex grid · 15-move budget · Catalyst letter</p>
	<p class="text-sm text-gray-600">Coming soon</p>
	<a href="/" class="mt-4 text-forge-orange hover:underline">← Back</a>
</main>

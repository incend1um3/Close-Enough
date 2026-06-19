<script lang="ts">
	import './layout.css';
	import favicon from '$lib/assets/favicon.svg';
	import { onMount } from 'svelte';
	import { e192CacheStore, e24CacheStore, e96CacheStore, type Cache } from '$lib/stores/cache';
	import PrecomputeWorker from "$lib/calculator/workers/precompute?worker";
	import { get } from 'svelte/store';
	import { browser } from '$app/environment';
	import MdiGithub from '~icons/mdi/github';
	import OpenmojiBluesky from '~icons/openmoji/bluesky';
	import MaterialSymbolsBook2Rounded from '~icons/material-symbols/book-2-rounded';
	import { SITE_NAME } from '$lib/constants';
	import LogoWithBG from "$lib/assets/logo.svg";

	let { children } = $props();

	const workers = browser ? [24, 96, 192].map(() => new PrecomputeWorker()) : [];

	onMount(() => {
		if (get(e192CacheStore) !== null) {
			return;
		};

		console.time("precompute");
		Promise.all([24, 96, 192].map((eseries, i) => 
			new Promise((resolve) => {
				workers[i].onmessage = e => {
					resolve(e.data.results);
					workers[i].terminate();
				};
				workers[i].postMessage({ eseries });
			})
			.then(results => {
				switch (eseries) {
					case 24: e24CacheStore.set(results as Cache); 	break;
					case 96: e96CacheStore.set(results as Cache);	break;
					case 192: e192CacheStore.set(results as Cache);	break;
				};
			})
		))
		.then(() => {
			console.timeEnd("precompute");
		});
	})
</script>

<svelte:head><link rel="icon" href={favicon} /></svelte:head>
<main class="p-1 sm:p-10 min-h-dvh">
	{@render children()}
</main>

<footer class="bg-amber-950 text-slate-200 flex gap-[10%] justify-center py-8 p-4 mt-auto">
	<div class="flex flex-col">
		<div class="flex gap-2 items-center">
			<img src={LogoWithBG} alt="logo" class="size-10"/>
			<p class="font-bold text-4xl">{SITE_NAME}</p>
		</div>
		<p class="opacity-90 mt-2">A PCB design utility - made with ❤️ by incend1um</p>
		<a href="https://github.com/incend1um3/Close-Enough" class="mt-4 py-2 px-4 rounded-lg bg-cyan-600 w-fit flex gap-4">Contribute <MdiGithub /></a>
	</div>
	<div class="flex flex-col gap-1">
		<p class="font-bold text-xl">Socials</p>
		<div class="grid grid-cols-2 gap-y-0.5 gap-x-10">
			<a href="https://incendium.me" class="opacity-80 hover:underline">Blog</a>
			<a href="https://incendium.me"><MaterialSymbolsBook2Rounded /></a>
			<a href="https://github.com/incend1um3" class="opacity-80 hover:underline">Github</a>
			<a href="https://github.com/incend1um3"><MdiGithub /></a>
			<a href="https://bsky.app/profile/incend1um.bsky.social" class="opacity-80 hover:underline">Bluesky</a>
			<a href="https://bsky.app/profile/incend1um.bsky.social"><OpenmojiBluesky /></a>
		</div>
	</div>
</footer>

<script lang="ts">
	import './layout.css';
	import favicon from '$lib/assets/favicon.svg';
	import { onMount } from 'svelte';
	import { e192CacheStore, e24CacheStore, e96CacheStore, type Cache } from '$lib/stores/cache';
	import PrecomputeWorker from "$lib/calculator/workers/precompute?worker";
	import { get } from 'svelte/store';
	import { browser } from '$app/environment';

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
			console.info("Precomputed series and parallel combinations for N=2");
		});
	})
</script>

<svelte:head><link rel="icon" href={favicon} /></svelte:head>
{@render children()}

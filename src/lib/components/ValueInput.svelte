<script lang="ts">
	import { parseValue } from "$lib/parse-value";
	import { e192CacheStore, e24CacheStore, e96CacheStore } from "$lib/stores/cache";
	import Result, { err, ok } from "true-myth/result";
	import ESeriesSelector from "./ESeriesSelector.svelte";
	import InfoTooltip from "./InfoTooltip.svelte";
	import type { ComputeRequest } from "$lib/calculator/workers/solver";

	let { 
		computeReq: req = $bindable(),
		error = $bindable(),
		...rest
	}: { 
		computeReq: ComputeRequest,
		error: boolean,
		class?: string,
	} = $props();

	let input = $state(String(req.target ?? ""));

	let inputParsed = $derived(parseValue(input).andThen(v => v.value > 0 ? ok(v) : err("Value must be greater than zero!")));

	$effect(() => {
		if (inputParsed.isOk) {
			req.target = inputParsed.value.value;
		}
	});

	$effect(() => {
		error = !(
			inputParsed.isOk &&
			(req.e24Subset || req.e96Subset || req.useE192)
		);
	});

	let libSize = $derived(
		($e24CacheStore?.sortedSeriesIndices.length || 0) +
		($e96CacheStore?.sortedSeriesIndices.length || 0) +
		($e192CacheStore?.sortedSeriesIndices.length || 0)
	);
</script>

<div class="p-8 border border-gray-300 shadow-sm w-fit bg-amber-50 self-start min-w-[340px] {rest.class}">
	<div class="flex flex-col flex-1">
		<p>TARGET RESISTANCE</p>
		<div class="flex gap-4 items-stretch border border-gray-300">
			<input
				type="text"
				bind:value={input}
				class="flex-1 bg-transparent border-none focus:outline-none focus:ring-0 text-2xl tracking-wide"
			>
			<div class="p-2 border-l border-gray-300 aspect-square text-center items-center text-2xl font-bold">
				Ω
			</div>
		</div>
	</div>
	{#if inputParsed.isOk}
		<p class="opacity-50">= {inputParsed.value.value}Ω</p>
	{:else}
		<p class="text-rose-500">Failed to parse</p>
	{/if}
	<p class="mb-4 opacity-50">Type with prefix: 3.3k, 4k7, 100n, 22µF</p>

	<p>MAX NUMBER OF COMPONENTS</p>
	<div class="flex gap-4">
		{#each [1, 2, 3] as i}
			<button
				data-selected={req.n === i}
				class="border border-gray-300 data-[selected=true]:border-amber-500 data-[selected=true]:bg-amber-500 
				w-12 h-12 font-bold flex items-center justify-center rounded-sm text-xl" 
				onclick={() => req.n = i as any}
			>
				{i}
			</button>
		{/each}
	</div>
	<p class="opacity-50 mb-6">Higher value = more search time</p>

	<p>
		E-SERIES 
		<InfoTooltip>
			<p class="mb-2">Each combination is generated from one E-series only.</p>
			<p>For example, a combination may contain E24 + E24, but never something like E24 + E48</p>
		</InfoTooltip>
	</p>
	<ESeriesSelector bind:e24Subset={req.e24Subset} bind:e96Subset={req.e96Subset} bind:useE192={req.useE192}/>

	<p class="mt-4">CUSTOM VALUES</p>
	<textarea class="bg-bg-200 border border-gray-300 cursor-not-allowed" placeholder="Not yet implemented." disabled></textarea>
	<p class="opacity-50 text-right">0/1000</p>

	<div class="w-full flex justify-between opacity-50 mt-6">
		<p>Library size</p>
		<p>{libSize} values</p>
	</div>
</div>
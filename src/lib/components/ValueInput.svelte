<script lang="ts">
	import { ESERIES_LIST, type E24Subset, type E96Subset, type ESeries } from "$lib/calculator/eseries";
	import { parseValue } from "$lib/parse-value";
	import { e192CacheStore, e24CacheStore, e96CacheStore } from "$lib/stores/cache";
	import { get } from "svelte/store";
	import Result, { err, ok } from "true-myth/result";

	let { 
		v1 = $bindable(), 
		v2 = $bindable(undefined),
		v1Label,
		v2Label,
		n = $bindable(),
		selectedE24Subset = $bindable(24),
		selectedE96Subset = $bindable(96),
		e192Selected = $bindable(false),
		symbol,
		...rest
	}: { 
		v1: number, 
		v2?: number, 
		v1Label: string,
		v2Label?: string,
		n: number,
		selectedE24Subset: E24Subset | null,
		selectedE96Subset: E96Subset | null,
		e192Selected: boolean,
		symbol: string,
		class?: string,
	} = $props();

	function countSigFigs(s: string): number {
	    const match = s.match(/^([0-9.]+)/);
	    if (!match) return 0;
	    const n = match[1];

	    if (n.includes('.')) {
	        // Decimal present: trailing zeros ARE significant
	        // Strip leading zeros up to first non-zero digit
	        const sig = n.replace(/^0*\.?0*/, '').replace('.', '');
	        return sig.length || 1;
	    } else {
	        // No decimal: trailing zeros are ambiguous — strip them
	        const sig = n.replace(/^0+/, '').replace(/0+$/, '');
	        return sig.length || 1;
	    }
	}

	let inputs = $state({ 1: "", 2: "" });

	let input1Scaled = $derived(parseValue(inputs[1]));
	let input2Scaled = $derived(parseValue(inputs[2]));

	$effect(() => {
		if (input1Scaled.isOk) {
			v1 = input1Scaled.value.value;
		}
		if (input2Scaled.isOk) {
			v2 = input2Scaled.value.value;
		}
	});

	let libSize = $derived(
		(get(e24CacheStore)?.sortedSeriesIndices.length || 0) +
		(get(e96CacheStore)?.sortedSeriesIndices.length || 0) +
		(get(e192CacheStore)?.sortedSeriesIndices.length || 0)
	);
</script>

{#snippet inputBox(label: string, input: 1 | 2)}
	<div class="flex flex-col flex-1">
		<p>{label}</p>
		<div class="flex gap-4 items-stretch border border-gray-300">
			<input
				type="text"
				bind:value={inputs[input]}
				class="flex-1 bg-transparent border-none focus:outline-none focus:ring-0 text-2xl tracking-wide"
			>
			<div class="p-3 border-l border-gray-300 aspect-square text-center items-center text-2xl font-bold">
				{symbol}
			</div>
		</div>
	</div>
{/snippet}

<div class="p-8 border border-gray-300 shadow-sm w-fit bg-amber-50 self-start {rest.class}">
	<div class="flex gap-8">
		{@render inputBox(v1Label, 1)}
		{#if v2Label}
			{@render inputBox(v2Label, 2)}
		{/if}
	</div>
	{#if input1Scaled.isOk}
		<p class="opacity-50">= {input1Scaled.value.value}{symbol}</p>
	{:else}
		<p class="text-rose-500">Failed to parse</p>
	{/if}
	<p class="mb-6 opacity-50">Type with prefix: 3.3k, 4k7, 100n, 22µF</p>

	<p>MAX NUMBEF OF COMPONENTS</p>
	<div class="flex gap-4">
		{#each [1, 2, 3] as i}
			<button
				data-selected={n === i}
				class="border border-gray-300 data-[selected=true]:border-amber-500 data-[selected=true]:bg-amber-500 
				w-12 h-12 font-bold flex items-center justify-center rounded-sm text-xl" 
				onclick={() => n = i}
			>
				{i}
			</button>
		{/each}
	</div>
	<p class="opacity-50 mb-6">Higher value = more search time</p>

	<p>E-SERIES</p>
	<div class="flex gap-4 mb-6">
		{#each ESERIES_LIST as value}
			<button
				data-selected={selectedE24Subset === value || selectedE96Subset === value || (value === 192 && e192Selected)}
				class="border border-gray-300 data-[selected=true]:border-amber-500 data-[selected=true]:bg-amber-500 
				w-13 h-10 font-semibold flex items-center justify-center rounded-sm"
				onclick={() => {
					if (value <= 24) {
						selectedE24Subset = selectedE24Subset === value ? null : value as E24Subset;
					} else if (value <= 96) {
						selectedE96Subset = selectedE96Subset === value ? null : value as E96Subset;
					} else {
						e192Selected = !e192Selected;
					}
				}}
			>
				E{value}
			</button>

			{#if value === 24 || value === 96}
				<span class="rounded-lg border border-gray-200 mx-2"></span>
			{/if}
		{/each}
	</div>

	<p>CUSTOM VALUES</p>
	<textarea class="mb-6"></textarea>

	<div class="w-full flex justify-between opacity-50">
		<p>Library size</p>
		<p>{libSize} values</p>
	</div>
</div>
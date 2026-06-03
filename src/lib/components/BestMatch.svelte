<script lang="ts">
	import { MathUtil } from '$lib/math';
	import MaterialSymbolsKidStar from '~icons/material-symbols/kid-star';
	import { formatSiValue } from '$lib/format-si';
	import type { Combination } from '$lib/calculator/workers/solver';
	import SeriesResistor from './circuit-display/SeriesResistor.svelte';
	import ParallelResistor from './circuit-display/ParallelResistor.svelte';
	import SingleResistor from './circuit-display/SingleResistor.svelte';
	import Parallel3 from './circuit-display/Parallel3.svelte';
	import Series3 from './circuit-display/Series3.svelte';
	import SeriesTwoParallelOne from './circuit-display/SeriesTwoParallelOne.svelte';
	import Parallel2Series1 from './circuit-display/Parallel2Series1.svelte';

	const { 
		targetValue,
		selectedCombination,
		solveTime = 0,
	}: {
		targetValue: number,
		selectedCombination: Combination,
		solveTime: number,
	} = $props();

	let percentageDifference = $derived(MathUtil.percentageDifference(targetValue, selectedCombination.result));
	let numComponents = $derived.by(() => {
		switch (selectedCombination.type) {
			case 'single': return 1;
			case 'series':
			case 'parallel': return 2;
			default: return 3;
		}
	})
</script>

<div class="flex flex-col border border-l-3 rounded-l-lg border-amber-600 p-8 flex-1 border-y-gray-300 border-r-gray-300 shadow-sm bg-amber-50">
	<div class="flex justify-between items-center mb-4">
		<div class="text-amber-600 text-xl">BEST MATCH</div>
		<div class={`rounded-lg py-1 px-2 flex gap-2 items-center text-lg ${percentageDifference <= 1.0 ? 'bg-green-300/70' : percentageDifference <= 10.0 ? 'bg-yellow-300' : 'bg-red-400'}`}>
			{#if percentageDifference <= 0.01}
				EXACT
				<MaterialSymbolsKidStar class="mix-blend-screen text-white"/>
			{:else}	
				{parseFloat(percentageDifference.toPrecision(3))}%
			{/if}
		</div>
	</div>
	<p class="text-6xl tracking-wide">{formatSiValue(selectedCombination.result)}</p>
	<div>
		<p class="opacity-60 whitespace-pre">{numComponents} COMPONENT{numComponents > 1 ? 'S' : ''}  •  Solved in {parseFloat(solveTime.toFixed(2))}ms</p>
	</div>
	<div class="mx-auto">
		{#if selectedCombination.type === 'single'}
			<SingleResistor r1={selectedCombination.result} />
		{:else if selectedCombination.type === 'series'}
			<SeriesResistor r1={selectedCombination.v1} r2={selectedCombination.v2}/>
		{:else if selectedCombination.type === 'parallel'}
			<ParallelResistor r1={selectedCombination.v1} r2={selectedCombination.v2}/>
		{:else if selectedCombination.type === "r+r+r"}
			<Series3 r1={selectedCombination.v1} r2={selectedCombination.v2} r3={selectedCombination.v3}/>
		{:else if selectedCombination.type === "r||r||r"}
			<Parallel3 r1={selectedCombination.v1} r2={selectedCombination.v2} r3={selectedCombination.v3}/>
		{:else if selectedCombination.type === "(r+r)||r"}
			<SeriesTwoParallelOne r1={selectedCombination.v1} r2={selectedCombination.v2} r3={selectedCombination.v3}/>
		{:else if selectedCombination.type === "(r||r)+r"}
			<Parallel2Series1 r1={selectedCombination.v1} r2={selectedCombination.v2} r3={selectedCombination.v3}/>
		{/if}
	</div>
</div>
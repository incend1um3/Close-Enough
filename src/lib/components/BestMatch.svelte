<script lang="ts">
	import { MathUtil } from '$lib/math';
	import MaterialSymbolsKidStar from '~icons/material-symbols/kid-star';
	import { formatSiValue } from '$lib/format-si';
	import type { Combination, VoltageDividerCombination } from '$lib/calculator/workers/solver';
	import SeriesResistor from './circuit-display/SeriesResistor.svelte';
	import ParallelResistor from './circuit-display/ParallelResistor.svelte';
	import SingleResistor from './circuit-display/SingleResistor.svelte';
	import Parallel3 from './circuit-display/Parallel3.svelte';
	import Series3 from './circuit-display/Series3.svelte';
	import SeriesTwoParallelOne from './circuit-display/SeriesTwoParallelOne.svelte';
	import Parallel2Series1 from './circuit-display/Parallel2Series1.svelte';
	import VoltageDivider from './circuit-display/VoltageDivider.svelte';
	import { getNumComponentsFromCombination, isCombinationVoltageDivider } from '$lib/util';

	const { 
		targetValue,
		selectedCombination,
		solveTime = 0,
	}: {
		targetValue: number,
		selectedCombination: Combination | VoltageDividerCombination,
		solveTime: number,
	} = $props();

	let result = $derived(isCombinationVoltageDivider(selectedCombination) ? selectedCombination.vout : selectedCombination.result);

	let percentageDifference = $derived(MathUtil.percentageDifference(targetValue, result));
	let numComponents = $derived(getNumComponentsFromCombination(selectedCombination));
</script>

<div class="flex flex-col border border-l-3 rounded-l-lg border-amber-600 p-4 sm:p-8 flex-1 border-y-gray-300 border-r-gray-300 shadow-sm bg-amber-50">
	<div class="flex justify-between items-center mb-4">
		<div class="text-amber-600 text-lg sm:text-xl">BEST MATCH</div>
		<div class={`rounded-lg py-1 px-2 flex gap-2 items-center text-lg ${percentageDifference <= 1.0 ? 'bg-green-300/70' : percentageDifference <= 10.0 ? 'bg-yellow-300' : 'bg-red-400'}`}>
			{#if percentageDifference <= 0.01}
				EXACT
				<MaterialSymbolsKidStar class="mix-blend-screen text-white"/>
			{:else}	
				{parseFloat(percentageDifference.toPrecision(3))}%
			{/if}
		</div>
	</div>
	<p class="text-6xl tracking-wide">{formatSiValue(result, false, isCombinationVoltageDivider(selectedCombination) ? 'V' : 'Ω')}</p>
	<p class="opacity-70 whitespace-pre-wrap">
		<!-- For some reason, the second space after the dot gets trimmed -->
		<span class="whitespace-pre">E-{selectedCombination.eSeries}  •&nbsp;   </span>
		<span class="whitespace-pre">{numComponents} COMPONENT{numComponents > 1 ? 'S' : ''}  •&nbsp; </span>
	    {#if isCombinationVoltageDivider(selectedCombination)}
	        <span class="whitespace-pre">{formatSiValue(selectedCombination.outputImpedance, false)} Output Impedance  •&nbsp; </span>
	        <span class="whitespace-pre">{formatSiValue(selectedCombination.totalImpedance, false)} Total Impedance  •&nbsp; </span>
	        <span class="whitespace-pre">{formatSiValue(selectedCombination.current, false, 'A')} Bleed Current  •&nbsp; </span>
		{/if}
	    <span>Solved in {parseFloat(solveTime.toFixed(2))}ms</span>
	</p>
	{#if !isCombinationVoltageDivider(selectedCombination)}
		<div class="w-full max-w-125 mx-auto mt-4">
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
	{:else}
		<div class="w-full max-w-80 mx-auto mt-4">
			<VoltageDivider vin={selectedCombination.vin} vout={selectedCombination.vout} r1={selectedCombination.top.v1} r2={selectedCombination.bottom.v1}/>
		</div>
	{/if}
</div>
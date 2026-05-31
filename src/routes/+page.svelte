<script lang="ts">
	import { type E96Subset, type E24Subset } from "$lib/calculator/eseries";
	import SolverWorker from "$lib/calculator/workers/solver?worker";
	import { type SolverAPI, type Combination } from "$lib/calculator/workers/solver";
	import BestMatch from "$lib/components/BestMatch.svelte";
	import Tab from "$lib/components/Tab.svelte";
	import ValueInput from "$lib/components/ValueInput.svelte";
	import { e192CacheStore, e24CacheStore, e96CacheStore } from "$lib/stores/cache";
	import { wrap, type Remote } from "comlink";
	import { get } from "svelte/store";
	import { debounce } from 'lodash-es';
	import { onMount } from "svelte";
	import Match from "$lib/components/Match.svelte";

	let active: "resistor" | "capacitor" | "voltage-divider" = $state("resistor");
	let v1: number = $state(0);
	let v2: number = $state(0);
	let n: 1 | 2 | 3 = $state(1);
	let e24Subset = $state<E24Subset>(24);
	let e96Subset = $state<E96Subset>(96);
	let e192Selected = $state(false);

	$effect(() => {
		localStorage.setItem("values", JSON.stringify({
			active,
			v1,
			v2,
			e24Subset,
			e96Subset,
			e192Selected
		}));
	})

	// prevent worker from initializing during SSR
	let rawSolverWorker: Worker | undefined;
	let worker: Remote<SolverAPI> | undefined;
	let resultsPromise: Promise<Combination[]> | undefined = $state();

	let triggerSolve = debounce(() => {
		const [e24Cache, e96Cache, e192Cache] = [get(e24CacheStore), get(e96CacheStore), get(e192CacheStore)]
		if (!e24Cache || !e96Cache || !e192Cache) {
			console.warn("waiting for cache to load")
			return;
		}

	    if (!worker) {
			rawSolverWorker = new SolverWorker();
			worker = wrap<SolverAPI>(rawSolverWorker);
			worker.init(e24Cache, e96Cache, e192Cache);
		}

    	console.time("solve");
    	resultsPromise = worker.solve({ n, e24Subset, e96Subset, useE192: e192Selected, target: v1 })
    	    .then(r => { console.timeEnd("solve"); return r; });
		}, 500);
	
	$effect(() => {
		n; e24Subset; e96Subset; e192Selected; v1;
		triggerSolve();
	})
</script>

<div class="flex flex-col">
	<div class="flex align-bottom items-end gap-8 mb-8">
		<h1 class="text-5xl">Good Enough</h1>
		<sub class="text-xl">Calculate the resistor/capacitor combination required to achieve your target value</sub>
	</div>

	<Tab bind:active={active} tabs={[
		{ id: "resistor", title: "Resistor", subtitle: "Series & Parallel", content: resistor},
		{ id: "capacitor", title: "Capacitor", subtitle: "Series & Parallel", content: capacitor},
		{ id: "voltage-divider", title: "Voltage Divider", subtitle: "Two Combinations", content: voltageDivider},
		{ id: "rc-delay", title: "RC Constant", subtitle: "Resistor + Capacitor", content: rcDelay},
	]}/>

</div>

{#snippet resistor()}
	<div class="flex justify-between gap-12">
		<ValueInput 
			v1Label="TARGET RESISTANCE" 
			bind:v1={v1} 
			bind:n={n} 
			bind:selectedE24Subset={e24Subset} 
			bind:selectedE96Subset={e96Subset} 
			bind:e192Selected={e192Selected}
			symbol="Ω"
		/>
			{#await resultsPromise}
				<div class="bg-amber-50 border border-gray-300 shadow-sm">
					<p>Solving...</p>
				</div>
			{:then results}
				{#if results}
					<div class="flex flex-col gap-3 flex-1">
						<BestMatch selectedCombination={results[0]} targetValue={v1} />
						<p class="opacity-70 mt-5 tracking-wider">ALTERNATIVES</p>
						<div class="grid grid-cols-2 gap-4">
							{#each results.splice(1) as c}
								<Match selectedCombination={c} targetValue={v1}/>
							{/each}
						</div>
					</div>
				{:else}
					<div class="bg-amber-50 border border-gray-300 shadow-sm">
						<p>Waiting for cache to load...</p>
					</div>
				{/if}		
			{/await}
	</div>
{/snippet}

{#snippet capacitor()}
{/snippet}

{#snippet voltageDivider()}
{/snippet}

{#snippet rcDelay()}
{/snippet}
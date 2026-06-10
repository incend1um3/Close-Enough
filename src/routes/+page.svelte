<script lang="ts">
	import SolverWorker from "$lib/calculator/workers/solver?worker";
	import { type SolverAPI, type Combination, type VoltageDividerCombination, type VoltageDividerComputeRequest, VoltageDividerComputeRequestSchema, parseVoltageDividerComputeRequest, type ComputeRequest, parseComputeRequest } from "$lib/calculator/workers/solver";
	import BestMatch from "$lib/components/BestMatch.svelte";
	import Tab from "$lib/components/Tab.svelte";
	import ValueInput from "$lib/components/ValueInput.svelte";
	import { allCacheLoaded, e192CacheStore, e24CacheStore, e96CacheStore } from "$lib/stores/cache";
	import { wrap } from "comlink";
	import { get } from "svelte/store";
	import { debounce } from 'lodash-es';
	import Match from "$lib/components/Match.svelte";
	import { browser } from "$app/environment";
	import VoltageDividerInput from "$lib/components/VoltageDividerInput.svelte";
	import { Maybe } from "true-myth";
	import { toMaybe } from "true-myth/toolbelt";
	import { untrack } from "svelte";

	let active: "resistor" | "voltage-divider" = $state("resistor");

	let voltageDividerComputeReq: VoltageDividerComputeRequest = $state(Maybe.of(browser ? localStorage.getItem("voltage-divider-solver-values") : null)
		.map(str => toMaybe(parseVoltageDividerComputeRequest(str)))
		.flatten()
		.unwrapOr({
			vin: 5,
			vout: 3.3,
			constraint: {
				'type': 'current',
				min: 0,
				max: 0.01
			},
			n: 2,
			maxOutputImpedance: 100000,
			e24Subset: 24,
			e96Subset: null,
			useE192: false,
		})
	);
	let resistorComputeReq: ComputeRequest = $state(Maybe.of(browser ? localStorage.getItem("resistor-solver-values") : null)
		.map(str => toMaybe(parseComputeRequest(str)))
		.flatten()
		.unwrapOr({
			target: 9.81,
			n: 2,
			e24Subset: 24,
			e96Subset: null,
			useE192: false,
		})
	)
	
	let solveTime = $state(0);
	let resultsPromise: Promise<Combination[]> | undefined = $state();
	let voltageDividerResultsPromise: Promise<VoltageDividerCombination[]> | undefined = $state();
	let solverState: 'idle' | 'solving' = $state('idle');

	$effect(() => {
		localStorage.setItem("resistor-solver-values", JSON.stringify(resistorComputeReq));
		localStorage.setItem("voltage-divider-solver-values", JSON.stringify(voltageDividerComputeReq));
	})

	// prevent worker from initializing during SSR
	let rawSolverWorker = browser ? new SolverWorker() : undefined;
	let worker = browser ? wrap<SolverAPI>(rawSolverWorker!) : undefined;
	let workerInited = false;

	let triggerSolve = debounce(() => {
		solverState = "solving";
	    if (!workerInited) {
			worker!.init(get(e24CacheStore)!, get(e96CacheStore)!, get(e192CacheStore)!);
			workerInited = true;
		}

    	const t1 = performance.now();
    	resultsPromise = worker!.solve(resistorComputeReq)
    	    .then(r => { 
				solveTime = performance.now() - t1; 
				console.log(`solve time: ${solveTime.toFixed(2)}ms`);
				solverState = "idle";
				return r;
			});
		}, 500);

	let triggerSolveVoltageDivider = debounce(() => {
		solverState = "solving";
		if (!workerInited) {
			worker!.init(get(e24CacheStore)!, get(e96CacheStore)!, get(e192CacheStore)!);
			workerInited = true;
		}

    	const t1 = performance.now();
    	voltageDividerResultsPromise = worker!.solveVoltageDivider($state.snapshot(voltageDividerComputeReq))
    	    .then(r => { 
				solveTime = performance.now() - t1; 
				console.log(`solve time: ${solveTime.toFixed(2)}ms`);
				solverState = "idle";
				return r;
			});
		}, 500);
	
	$effect(() => {
		if (!$allCacheLoaded) {
			return;
		}

		$state.snapshot(resistorComputeReq); $state.snapshot(voltageDividerComputeReq);
		if (untrack(() => active) === "resistor") {
			triggerSolve();
		} else {
			triggerSolveVoltageDivider();
		}
	});

	// Solve on tab switch only if that tab has no results yet
	$effect(() => {
	    if (!$allCacheLoaded) return;
	    
		active;
	    untrack(() => {
	        if (active === "resistor" && resultsPromise === undefined) {
	            triggerSolve();
	        } else if (active !== "resistor" && voltageDividerResultsPromise === undefined) {
	            triggerSolveVoltageDivider();
	        }
	    });
	});
</script>

<div class="flex flex-col">
	<div class="flex align-bottom items-end gap-8 mb-8">
		<h1 class="text-5xl">Close Enough</h1>
		<sub class="text-xl">Calculate the resistor/capacitor combination required to achieve your target value</sub>
	</div>

	<Tab bind:active={active} tabs={[
		{ id: "resistor", title: "Resistor", subtitle: "Series & Parallel", content: resistor},
		{ id: "voltage-divider", title: "Voltage Divider", subtitle: "Two Combinations", content: voltageDivider},
		{ id: "rc-delay", title: "RC Constant", subtitle: "Resistor + Capacitor", content: rcDelay},
	]}/>

</div>

{#snippet resistor()}
	<div class="flex gap-12">
		<ValueInput 
			v1Label="TARGET RESISTANCE" 
			bind:v1={resistorComputeReq.target} 
			bind:n={resistorComputeReq.n} 
			bind:selectedE24Subset={resistorComputeReq.e24Subset} 
			bind:selectedE96Subset={resistorComputeReq.e96Subset} 
			bind:e192Selected={resistorComputeReq.useE192}
			symbol="Ω"
			class="flex-2"
		/>
			{#await resultsPromise}
				<div class="bg-amber-50 border border-gray-300 shadow-sm">
					<p>Solving...</p>
				</div>
			{:then results}
				{#if results}
					<div class="flex flex-col gap-3 flex-3">
						<BestMatch selectedCombination={results[0]} targetValue={resistorComputeReq.target} solveTime={solveTime}/>
						<p class="opacity-70 mt-5 tracking-wider">ALTERNATIVES</p>
						<div class="grid grid-cols-2 gap-4">
							{#each results.slice(1) as c}
								<Match selectedCombination={c} targetValue={resistorComputeReq.target}/>
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

{#snippet voltageDivider()}
	<div class="flex gap-12">
		<VoltageDividerInput
			bind:computeReq={voltageDividerComputeReq}
			class="flex-2"
		/>
		{#await voltageDividerResultsPromise}
			<div class="bg-amber-50 border border-gray-300 shadow-sm">
				<p>Solving...</p>
			</div>
		{:then results}
			{#if results}
				<div class="flex flex-col gap-3 flex-3">
					<BestMatch selectedCombination={results[0]} targetValue={voltageDividerComputeReq.vout} solveTime={solveTime}/>
					<p class="opacity-70 mt-5 tracking-wider">ALTERNATIVES</p>
					<div class="grid grid-cols-2 gap-4">
						{#each results.slice(1) as c}
							<Match selectedCombination={c} targetValue={voltageDividerComputeReq.vout}/>
						{/each}
					</div>
				</div>
			{:else}
				<div class="bg-amber-50 border border-gray-300 shadow-sm flex-2">
					<p>Waiting for cache to load...</p>
				</div>
			{/if}		
		{/await}
	</div>
{/snippet}

{#snippet rcDelay()}
{/snippet}
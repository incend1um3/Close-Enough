<script lang="ts">
	import { browser } from '$app/environment';
	import { page } from '$app/state';
	import {
		setCalculatorContext as setCalculatorContext,
		type SolverContext
	} from '$lib/calculator/context';
	import {
		parseComputeRequest,
		parseVoltageDividerComputeRequest,
		type ComputeRequest,
		type SolverAPI,

		type VoltageDividerComputeRequest


	} from '$lib/calculator/workers/solver';
	import { wrap } from 'comlink';
	import { Maybe } from 'true-myth';
	import { toMaybe } from 'true-myth/toolbelt';
	import SolverWorker from "$lib/calculator/workers/solver?worker";
	import { get } from 'svelte/store';
	import { e24CacheStore, e96CacheStore, e192CacheStore, allCacheLoaded } from '$lib/stores/cache';
	import Tab from '$lib/components/Tab.svelte';
	import { debounce } from 'lodash-es';
	import { untrack } from 'svelte';
	import { tryOr } from 'true-myth/result';

	let { children } = $props();

	const context: SolverContext = $state({
		resistance: {
			computeReq: Maybe.of(browser ? localStorage.getItem('resistor-solver-values') : null)
				.andThen(str => {
					try { return Maybe.just<ComputeRequest>(JSON.parse(str)) }
					catch { return Maybe.nothing<ComputeRequest>() }
				})
				.andThen(obj => toMaybe(parseComputeRequest(obj)))
				.unwrapOr({
					target: 9.81,
					n: 2,
					e24Subset: 24,
					e96Subset: null,
					useE192: false
				}),
			inputError: false,
			resultsPromise: null,
			solveTime: 0
		},
		voltageDivider: {
			computeReq: Maybe.of(browser ? localStorage.getItem('voltage-divider-solver-values') : null)
				.andThen(str => {
					try { return Maybe.just<VoltageDividerComputeRequest>(JSON.parse(str)) }
					catch { return Maybe.nothing<VoltageDividerComputeRequest>() }
				})
				.andThen(obj => toMaybe(parseVoltageDividerComputeRequest(obj)))
				.unwrapOr({
					vin: 5,
					vout: 3.3,
					constraint: { type: 'current', min: 0, max: 0.01 },
					n: 2,
					maxOutputImpedance: 100000,
					pinnedR1: null,
					e24Subset: 24,
					e96Subset: null,
					useE192: false
				}),
			inputError: false,
			resultsPromise: null,
			solveTime: 0,
		},
	});

	setCalculatorContext(context);

	let activeId: 'resistor' | 'voltage-divider' = $derived(
		page.url.pathname.includes('voltage-divider') ? 'voltage-divider' : 'resistor'
	);

	let rawSolverWorker = browser ? new SolverWorker() : undefined;
	let worker = browser ? wrap<SolverAPI>(rawSolverWorker!) : undefined;
	let workerInited = false;
	function ensureWorkerInitialized() {
		if (!workerInited) {
			worker!.init(get(e24CacheStore)!, get(e96CacheStore)!, get(e192CacheStore)!);
			workerInited = true;
		}
	}

	const triggerSolve = debounce(() => {
		ensureWorkerInitialized();
 
		const t1 = performance.now();
		context.resistance.resultsPromise = worker!.solve($state.snapshot(context.resistance.computeReq)).then((r) => {
			context.resistance.solveTime = performance.now() - t1;
			console.log(`solve time: ${context.resistance.solveTime.toFixed(2)}ms`);
			return r;
		});
	}, 500);
 
	const triggerSolveVoltageDivider = debounce(() => {
		ensureWorkerInitialized();
 
		const t1 = performance.now();
		context.voltageDivider.resultsPromise = worker!
			.solveVoltageDivider($state.snapshot(context.voltageDivider.computeReq))
			.then((r) => {
				context.voltageDivider.solveTime = performance.now() - t1;
				console.log(`solve time: ${context.voltageDivider.solveTime.toFixed(2)}ms`);
				return r;
			});
	}, 500);

	$effect(() => {
		if (!$allCacheLoaded) return;
 
		$state.snapshot(context.resistance.computeReq);
		$state.snapshot(context.voltageDivider.computeReq);
		if (untrack(() => activeId) === 'resistor') {
			triggerSolve();
		} else {
			triggerSolveVoltageDivider();
		}
	});
 
	// On tab switch, solve the newly active tool only if it has no results yet
	$effect(() => {
		if (!$allCacheLoaded) return;
 
		activeId;
		untrack(() => {
			if (activeId === 'resistor' && !context.resistance.resultsPromise) {
				triggerSolve();
			} else if (activeId === 'voltage-divider' && !context.voltageDivider.resultsPromise) {
				triggerSolveVoltageDivider();
			}
		});
	});

</script>

<div class="flex flex-col">
	<div class="flex align-bottom items-end gap-x-8 mb-2 sm:mb-4 flex-wrap">
		<div class="flex text-center md:text-start">
			<p class="text-4xl hidden text-nowrap site-name">Close Enough —&nbsp;</p>
			<h1 class="text-4xl">{activeId === "resistor" ? "Resistor Combination Solver" : "Voltage Divider Solver"}</h1>
		</div>
	</div>

	<Tab tabs={[
		{ href: "/calculator/resistance", title: "Resistance", subtitle: "Series & Parallel"},
		{ href: "/calculator/voltage-divider", title: "Voltage Divider", subtitle: "S/P + Single"},
	]}/>
	
	{@render children()}
</div>

<style>
	.site-name {
		@media (width >= 58rem) {
			display: block;
		}
	}
</style>
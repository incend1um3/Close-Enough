import { MathUtil } from "$lib/math";
import { e192CacheStore, e24CacheStore, e96CacheStore, iterCombinationsFromCache, iterResistorValuesFromCache, type Cache } from "$lib/stores/cache";
import { FixedReverseHeap } from "mnemonist";
import { get } from "svelte/store";
import { type E96Subset, type E24Subset, type ESeries, isBaseInESeries, isValueBaseInEseries, type CachedESeries } from "../eseries";
import { expose } from 'comlink';

export type Combination =
	| {
		type: 'single';
		result: number;
		percentDiff: number,
	}
	| {
		type: 'series' | 'parallel';
		v1: number;
		v2: number;
		result: number,
		percentDiff: number,
	}
	| {
		type: 's3' | 'p3' | 's2p1' | 'p2s1';
		v1: number;
		v2: number;
		v3: number;
		result: number,
		percentDiff: number,
	};

export type ComputeRequest = {
	target: number,
	n: number,
	e24Subset: E24Subset | null,
	e96Subset: E96Subset | null,
	useE192: boolean,
}

export type VoltageDividerComputeRequest = {
	vin: number,
	vout: number,
	constraint: { type: 'current', min: number, max: number } | { type: 'impedance', min: number, max: number },
	n: number,
	e24Subset: E24Subset | null,
	e96Subset: E96Subset | null,
	useE192: boolean,
}

export function findClosestResistorValuesN1(ohms: number, e24Subset: E24Subset | null, e96Subset: E96Subset | null, useE192: boolean) {
	let heap = new FixedReverseHeap<{ type: 'single', result: number, percentDiff: number }>(
		Array,
		(a, b) => a.percentDiff - b.percentDiff,
		20
	);
	
	function run(eseries: ESeries) {
		for (let r of iterResistorValuesFromCache(eseries)) {
			let percentDiff = MathUtil.percentageDifference(ohms, r);
			heap.push({ type: 'single', result: r, percentDiff });
		}
	}

	if (e24Subset) run(e24Subset);
	if (e96Subset) run(e96Subset);
	if (useE192) run(192);

	return (heap.consume() as Array<{ type: 'single', result: number; percentDiff: number }>)
		.sort((a, b) => a.percentDiff - b.percentDiff);
}

function binarySearch(values: Float32Array, x: number): number {
	let head = 0, tail = values.length - 1;
	while (head <= tail) {
		let mid = (head + tail) >>> 1;
		let value = values[mid];

		if (value === x) {
			return mid;
		}

		if (value > x) {
			tail = mid - 1;
		} else {
			head = mid + 1;
		}
	}

	// After the loop: tail = head - 1
	// Closest is whichever neighbour is nearer to x (with bounds checks)
	if (tail < 0) return head;
	if (head >= values.length) return tail;

	const headVal = values[head];
	const tailVal = values[tail];
	const closestPos = Math.abs(headVal - x) <= Math.abs(tailVal - x) ? head : tail;
	return closestPos;
}

// Returns the closest value's index
function binarySearchWithIndices(sortedIndices: Uint32Array, values: Float32Array, x: number): number {
	if (sortedIndices.length !== values.length) throw new Error("array lengths of indices and values must match!");

	let head = 0, tail = values.length - 1;
	while (head <= tail) {
		let mid = (head + tail) >>> 1;
		let value = values[sortedIndices[mid]];
		
		if (value === x) {
			return mid;
		}

		if (value > x) {
			tail = mid - 1;
		} else {
			head = mid + 1;
		}
	}

	// After the loop: tail = head - 1
	// Closest is whichever neighbour is nearer to x (with bounds checks)
	if (tail < 0) return head;
	if (head >= sortedIndices.length) return tail;

	const headVal = values[sortedIndices[head]];
	const tailVal = values[sortedIndices[tail]];
	const closestPos = Math.abs(headVal - x) <= Math.abs(tailVal - x) ? head : tail;
	return closestPos;
}

function* closestCombinations(cache: Cache, combinationArray: 'series' | 'parallel', eSeries: ESeries, target: number) {
	let sortedIndices, values;
	if (combinationArray === 'series') {
		sortedIndices = cache.sortedSeriesIndices;
		values = cache.seriesResults;
	} else {
		sortedIndices = cache.sortedParallelIndices;
		values = cache.parallelResults;
	}

	let index = binarySearchWithIndices(sortedIndices, values, target);
	let leftCount = Math.min(index, 5);
	let rightCount = Math.min(sortedIndices.length - 1 - index, 5);

	// All values in cache are eligible, so don't filter
	if ([24, 96, 192].includes(eSeries)) {
		for (let i = index - leftCount; i <= index + rightCount; i++) {
			let value = values[sortedIndices[i]];
			let diff = MathUtil.percentageDifference(target, value);
			yield { value, diff, index: i };
		}

		return;
	}

	let valuesYieldedFromLeft = 0;
	let left = index - 1;
	while (valuesYieldedFromLeft < 5 && left >= 0) {
		let sortedIndex = sortedIndices[left];
		let value = values[sortedIndex];
		if (!isValueBaseInEseries(cache.r1s[sortedIndex], eSeries) || !isValueBaseInEseries(cache.r2s[sortedIndex], eSeries)) {
			left--;
			continue;
		}

		let diff = MathUtil.percentageDifference(target, value);
		yield { value, diff, index: left };

		left--;
		valuesYieldedFromLeft++;
	}

	let valuesYieldedFromRight = 0;
	let right = index;
	while (valuesYieldedFromRight < 5 && right < sortedIndices.length) {
		let sortedIndex = sortedIndices[right];
		let value = values[sortedIndex];
		if (!isValueBaseInEseries(cache.r1s[sortedIndex], eSeries) || !isValueBaseInEseries(cache.r2s[sortedIndex], eSeries)) {
			right++;
			continue;
		}

		let diff = MathUtil.percentageDifference(target, value);
		yield { value, diff, index: right };

		right++;
		valuesYieldedFromRight++;
	}
}

export function findClosestResistorValuesN2(ohms: number, e24Subset: E24Subset | null, e96Subset: E96Subset | null, useE192: boolean): Combination[] {
	const e24Cache = get(e24CacheStore)!;
	const e96Cache = get(e96CacheStore)!;
	const e192Cache = get(e192CacheStore)!;

	let heap = new FixedReverseHeap<Combination>(
		Array,
		(a, b) => a.percentDiff - b.percentDiff,
		20
	);

	function run(cache: Cache, eSeries: ESeries) {
		for (const e of closestCombinations(cache, 'series', eSeries, ohms)) {
			heap.push({
				type: 'series',
				v1: cache.r1s[cache.sortedSeriesIndices[e.index]],
				v2: cache.r2s[cache.sortedSeriesIndices[e.index]],
				result: e.value,
				percentDiff: e.diff
			});
		}
		for (const e of closestCombinations(cache, 'parallel', eSeries, ohms)) {
			heap.push({
				type: 'parallel',
				v1: cache.r1s[cache.sortedParallelIndices[e.index]],
				v2: cache.r2s[cache.sortedParallelIndices[e.index]],
				result: e.value,
				percentDiff: e.diff
			});
		}
	}

	if (e24Subset) run(e24Cache, e24Subset);
	if (e96Subset) run(e96Cache, e96Subset);
	if (useE192) run(e192Cache, 192);

	let n1Results = findClosestResistorValuesN1(ohms, e24Subset, e96Subset, useE192);
	for (const r of n1Results) {
		heap.push(r);
	}

	return (heap.consume() as Array<Combination>)
		.sort((a, b) => a.percentDiff - b.percentDiff);
}

const api = {
	init(e24Cache: Cache, e96Cache: Cache, e192Cache: Cache) {
		e24CacheStore.set(e24Cache);
		e96CacheStore.set(e96Cache);
		e192CacheStore.set(e192Cache);

		if (self.crossOriginIsolated) {
			console.info("cross origin isolated is true");
		} else {
			console.error("cross origin isolated is false");
		}
	},

	solve(req: ComputeRequest): Combination[] {
		let results: Combination[];
		const t = performance.now();
		switch (req.n) {
			case 1: results = findClosestResistorValuesN1(req.target, req.e24Subset, req.e96Subset, req.useE192); break;
			case 2: results = findClosestResistorValuesN2(req.target, req.e24Subset, req.e96Subset, req.useE192); break;
			default: throw Error("invalid n")
		}
		console.log("solve body:", (performance.now() - t).toFixed(2), "ms");
		console.log("Finished computation")
		return results;
	},

	solveVoltageDivider() {

	}
}

if (typeof WorkerGlobalScope !== 'undefined' &&
	self instanceof WorkerGlobalScope
) {
	expose(api);
}
export type SolverAPI = typeof api;
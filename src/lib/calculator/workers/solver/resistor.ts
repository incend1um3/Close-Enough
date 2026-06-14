import { MathUtil } from "$lib/math";
import { e192CacheStore, e24CacheStore, e96CacheStore, iterResistorValuesFromCache, type Cache } from "$lib/stores/cache";
import { FixedReverseHeap } from "mnemonist";
import { get } from "svelte/store";
import { type E96Subset, type E24Subset, type ESeries, isValueBaseInEseries } from "../../eseries";
import { ONE_MILLI, decadeBounds, binarySearchWithIndices, closestCombinations, type Peekable } from "./util";

export type Combination =
	| {
		type: 'single';
		result: number;
		percentDiff: number;
		eSeries: ESeries;
	}
	| {
		type: 'series' | 'parallel';
		v1: number;
		v2: number;
		result: number;
		percentDiff: number;
		eSeries: ESeries;
	}
	| {
		type: 'r+r+r' | 'r||r||r' | '(r+r)||r' | '(r||r)+r';
		v1: number;
		v2: number;
		v3: number;
		result: number;
		percentDiff: number;
		eSeries: ESeries;
	};

export function findClosestResistorValuesN1(
	ohms: number,
	e24Subset: E24Subset | null,
	e96Subset: E96Subset | null,
	useE192: boolean
) {
	let heap = new FixedReverseHeap<Combination>(
		Array,
		(a, b) => a.percentDiff - b.percentDiff,
		20
	);

	function run(eSeries: ESeries) {
		for (let r of iterResistorValuesFromCache(eSeries)) {
			let percentDiff = MathUtil.percentageDifference(ohms, r);
			heap.push({ type: 'single', result: r, percentDiff, eSeries });
		}
	}

	if (e24Subset) run(e24Subset);
	if (e96Subset) run(e96Subset);
	if (useE192) run(192);

	return (heap.consume() as Array<Combination>)
		.sort((a, b) => a.percentDiff - b.percentDiff);
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
				percentDiff: e.diff,
				eSeries,
			});
		}
		for (const e of closestCombinations(cache, 'parallel', eSeries, ohms)) {
			heap.push({
				type: 'parallel',
				v1: cache.r1s[cache.sortedParallelIndices[e.index]],
				v2: cache.r2s[cache.sortedParallelIndices[e.index]],
				result: e.value,
				percentDiff: e.diff,
				eSeries,
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

// Can't use generators in a hot loop because we'd be thrashing the GC
const indexScratch = new Uint32Array(20);

export function findClosestResistorValuesN3(ohms: number, e24Subset: E24Subset | null, e96Subset: E96Subset | null, useE192: boolean): Combination[] {
	const NEIGHBORS_PER_SIDE = 5;
	const MAX_SCAN_PER_SIDE = 256;

	const e24Cache = get(e24CacheStore)!;
	const e96Cache = get(e96CacheStore)!;
	const e192Cache = get(e192CacheStore)!;

	let heap = new FixedReverseHeap<Combination>(
		Array,
		(a, b) => a.percentDiff - b.percentDiff,
		20
	) as any as Peekable<Combination>;

	function run(cache: Cache, eSeries: ESeries) {
		const noFilter = eSeries === 24 || eSeries === 96 || eSeries === 192;
		const [lo, hi] = decadeBounds(cache, -3, 7);

		function collectClosestMatches(
			sortedIndices: Uint32Array,
			values: Float32Array,
			target: number,
			maxOperand: number
		) {
			let index = binarySearchWithIndices(sortedIndices, values, target);
			let count = 0;

			let scanned = 0, yielded = 0, left = index - 1;
			while (yielded < NEIGHBORS_PER_SIDE && scanned < MAX_SCAN_PER_SIDE && left >= 0) {
				const sortedIndex = sortedIndices[left];
				const r1 = cache.r1s[sortedIndex];
				const r2 = cache.r2s[sortedIndex];

				if (r1 >= ONE_MILLI && r2 >= ONE_MILLI && r2 <= maxOperand && (noFilter || (isValueBaseInEseries(r2, eSeries) && isValueBaseInEseries(r1, eSeries)))) {
					indexScratch[count++] = left;
					yielded++;
				}

				left--, scanned++;
			}

			let right = index;
			scanned = 0, yielded = 0;
			while (yielded < NEIGHBORS_PER_SIDE && scanned < MAX_SCAN_PER_SIDE && right < sortedIndices.length) {
				const sortedIndex = sortedIndices[right];
				const r1 = cache.r1s[sortedIndex];
				const r2 = cache.r2s[sortedIndex];

				if (r1 >= ONE_MILLI && r2 >= ONE_MILLI && r2 <= maxOperand && (noFilter || (isValueBaseInEseries(r2, eSeries) && isValueBaseInEseries(r1, eSeries)))) {
					indexScratch[count++] = right;
					yielded++;
				}

				right++, scanned++;
			}

			return count;
		}

		for (let i = lo; i <= hi; i++) {
			const r3 = cache.resistorValues[i];
			if (!noFilter && !isValueBaseInEseries(r3, eSeries)) {
				continue;
			}

			let seriesSearchTarget = ohms - r3;
			let parallelSearchTarget = r3 > ohms ? (ohms * r3) / (r3 - ohms) : -1;

			if (seriesSearchTarget >= ONE_MILLI && seriesSearchTarget <= 2 * r3) {
				const count = collectClosestMatches(cache.sortedSeriesIndices, cache.seriesResults, seriesSearchTarget, r3);
				for (let i = 0; i < count; i++) {
					const sortedIndex = cache.sortedSeriesIndices[indexScratch[i]];
					let r1r2 = cache.seriesResults[sortedIndex];
					let combinationResult = r3 + r1r2;
					let percentDiff = Math.abs(ohms - combinationResult);

					if (heap.size < 20 || heap.peek()!.percentDiff > percentDiff) {
						heap.push({
							type: 'r+r+r',
							v1: cache.r1s[sortedIndex],
							v2: cache.r2s[sortedIndex],
							v3: r3,
							percentDiff,
							result: combinationResult,
							eSeries,
						});
					}
				}
			}

			if (parallelSearchTarget >= ONE_MILLI) {
				const count = collectClosestMatches(cache.sortedSeriesIndices, cache.seriesResults, parallelSearchTarget, Infinity);
				for (let i = 0; i < count; i++) {
					const sortedIndex = cache.sortedSeriesIndices[indexScratch[i]];
					let r1r2 = cache.seriesResults[sortedIndex];
					let combinationResult = (r1r2 * r3) / (r1r2 + r3);
					let percentDiff = Math.abs(ohms - combinationResult);

					if (heap.size < 20 || heap.peek()!.percentDiff > percentDiff) {
						heap.push({
							type: '(r+r)||r',
							v1: cache.r1s[sortedIndex],
							v2: cache.r2s[sortedIndex],
							v3: r3,
							percentDiff,
							result: combinationResult,
							eSeries,
						});
					}
				}
			}

			if (seriesSearchTarget >= ONE_MILLI) {
				const count = collectClosestMatches(cache.sortedParallelIndices, cache.parallelResults, seriesSearchTarget, Infinity);
				for (let i = 0; i < count; i++) {
					const sortedIndex = cache.sortedParallelIndices[indexScratch[i]];
					let r1r2 = cache.parallelResults[sortedIndex];
					let combinationResult = r1r2 + r3;
					let percentDiff = Math.abs(ohms - combinationResult);

					if (heap.size < 20 || heap.peek()!.percentDiff > percentDiff) {
						heap.push({
							type: '(r||r)+r',
							v1: cache.r1s[sortedIndex],
							v2: cache.r2s[sortedIndex],
							v3: r3,
							percentDiff,
							result: combinationResult,
							eSeries,
						});
					}
				}
			}

			if (parallelSearchTarget >= ONE_MILLI && parallelSearchTarget <= 0.5 * r3) {
				const count = collectClosestMatches(cache.sortedParallelIndices, cache.parallelResults, parallelSearchTarget, Infinity);
				for (let i = 0; i < count; i++) {
					const sortedIndex = cache.sortedParallelIndices[indexScratch[i]];
					let r1r2 = cache.parallelResults[sortedIndex];
					let combinationResult = (r1r2 * r3) / (r1r2 + r3);
					let percentDiff = Math.abs(ohms - combinationResult);

					if (heap.size < 20 || heap.peek()!.percentDiff > percentDiff) {
						heap.push({
							type: 'r||r||r',
							v1: cache.r1s[sortedIndex],
							v2: cache.r2s[sortedIndex],
							v3: r3,
							percentDiff,
							result: combinationResult,
							eSeries,
						});
					}
				}
			}
		}
	}

	if (e24Subset) run(e24Cache, e24Subset);
	if (e96Subset) run(e96Cache, e96Subset);
	if (useE192) run(e192Cache, 192);

	let n2Results = findClosestResistorValuesN2(ohms, e24Subset, e96Subset, useE192);
	for (const r of n2Results) {
		r.percentDiff = r.percentDiff * ohms / 100;
		heap.push(r);
	}

	let arr = (heap.consume() as Array<Combination>).sort((a, b) => a.percentDiff - b.percentDiff);
	for (let c of arr) {
		c.percentDiff = c.percentDiff / ohms * 100;
	}

	return arr;
}
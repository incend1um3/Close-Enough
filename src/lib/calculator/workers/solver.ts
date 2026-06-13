import { MathUtil } from "$lib/math";
import { e192CacheStore, e24CacheStore, e96CacheStore, iterResistorValuesFromCache, type Cache } from "$lib/stores/cache";
import { FixedReverseHeap } from "mnemonist";
import { get } from "svelte/store";
import { type E96Subset, type E24Subset, type ESeries, isValueBaseInEseries } from "../eseries";
import { expose } from 'comlink';
import { z } from "zod";
import { parserFor } from "true-myth/standard-schema";

const ONE_MILLI = 1e-3;

export type Combination =
	| {
		type: 'single';
		result: number;
		percentDiff: number,
		eSeries: ESeries,
	}
	| {
		type: 'series' | 'parallel';
		v1: number;
		v2: number;
		result: number,
		percentDiff: number,
		eSeries: ESeries,
	}
	| {
		type: 'r+r+r' | 'r||r||r' | '(r+r)||r' | '(r||r)+r';
		v1: number;
		v2: number;
		v3: number;
		result: number,
		percentDiff: number,
		eSeries: ESeries,
	};

const E24SubsetSchema = z.union([z.literal(6), z.literal(12), z.literal(24)]);
const E96SubsetSchema = z.union([z.literal(48), z.literal(96)]);

export const ComputeRequestSchema = z.object({
	target: z.number(),
	n: z.union([z.literal(1), z.literal(2), z.literal(3)]),
	e24Subset: E24SubsetSchema.nullable(),
	e96Subset: E96SubsetSchema.nullable(),
	useE192: z.boolean(),
});

export const parseComputeRequest = parserFor(ComputeRequestSchema);

export const VoltageDividerComputeRequestSchema = z.object({
	vin: z.number(),
	vout: z.number(),
	constraint: z.discriminatedUnion("type", [
		z.object({ type: z.literal("current"), min: z.number(), max: z.number() }),
		z.object({ type: z.literal("impedance"), min: z.number(), max: z.number() }),
	]),
	maxOutputImpedance: z.number(),
	n: z.number(),
	e24Subset: E24SubsetSchema.nullable(),
	e96Subset: E96SubsetSchema.nullable(),
	useE192: z.boolean(),
});

export const parseVoltageDividerComputeRequest = parserFor(VoltageDividerComputeRequestSchema);

// Inferred types (can replace your existing `export type` declarations)
export type ComputeRequest = z.infer<typeof ComputeRequestSchema>;
export type VoltageDividerComputeRequest = z.infer<typeof VoltageDividerComputeRequestSchema>;

export type VoltageDividerCombination = {
	top:
		| {
			type: 'single';
			v1: number;
		}
		| {
			type: 'series' | 'parallel';
			v1: number;
			v2: number;
		},
	bottom:
		| {
			type: 'single';
			v1: number;
		}
		| {
			type: 'series' | 'parallel';
			v1: number;
			v2: number;
		},
	outputImpedance: number,
	totalImpedance: number,
	current: number,
	vin: number,
	vout: number,
	percentDiff: number,
	eSeries: ESeries,
}

type Peekable<T> = FixedReverseHeap<T> & { peek(): T | undefined };

const START_DECADE = -12;
function decadeBounds(cache: Cache, minDecade: number, maxDecade: number) {
	const basesLen = cache.eSeries; // 24 | 96 | 192
	const lo = Math.max(0, (minDecade - START_DECADE)) * basesLen;
	const hi = Math.min(cache.resistorValues.length - 1, (maxDecade - START_DECADE + 1) * basesLen);
	return [lo, hi] as const; // [lo, hi)
}

// #region resistor
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

function binarySearch(values: Float32Array, x: number, head = 0, tail: number = values.length - 1): number {
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
	if (eSeries === 24 || eSeries === 96 || eSeries === 192) {
		for (let i = index - leftCount; i <= index + rightCount; i++) {
			let value = values[sortedIndices[i]];
			let diff = MathUtil.percentageDifference(target, value);
			yield { value, diff, index: i };
		}

		return;
	}

	let yielded = 0;
	let left = index - 1;
	while (yielded < 5 && left >= 0) {
		let sortedIndex = sortedIndices[left];
		let value = values[sortedIndex];
		if (!isValueBaseInEseries(cache.r1s[sortedIndex], eSeries) || !isValueBaseInEseries(cache.r2s[sortedIndex], eSeries)) {
			left--;
			continue;
		}

		let diff = MathUtil.percentageDifference(target, value);
		yield { value, diff, index: left };

		left--;
		yielded++;
	}

	yielded = 0;
	let right = index;
	while (yielded < 5 && right < sortedIndices.length) {
		let sortedIndex = sortedIndices[right];
		let value = values[sortedIndex];
		if (!isValueBaseInEseries(cache.r1s[sortedIndex], eSeries) || !isValueBaseInEseries(cache.r2s[sortedIndex], eSeries)) {
			right++;
			continue;
		}

		let diff = MathUtil.percentageDifference(target, value);
		yield { value, diff, index: right };

		right++;
		yielded++;
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

// #region Resistor N3
// Can't use generators in a hot loop because we'd be thrashing the GC
const indexScratch = new Uint32Array(20);
export function findClosestResistorValuesN3(ohms: number, e24Subset: E24Subset | null, e96Subset: E96Subset | null, useE192: boolean): Combination[] {
	const NEIGHBORS_PER_SIDE = 5;
	const MAX_SCAN_PER_SIDE = 256;	// limit the scan window for values that are from the required subset

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

			let scanned = 0, yielded = 0, left = index-1;
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
	
			// For deduplication, we want r1 < r2 < r3
			if (seriesSearchTarget >= ONE_MILLI && seriesSearchTarget <= 2*r3) {
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
						})
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

			if (parallelSearchTarget >= ONE_MILLI  && parallelSearchTarget <= 0.5 * r3) {
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
// #endregion

function solveVoltageDividerN2(
	vin: number,
	targetVout: number,
	maxOutputImpedance: number,
	minImpedance: number,
	maxImpedance: number,
	e24Subset: E24Subset | null, 
	e96Subset: E96Subset | null, 
	useE192: boolean
): VoltageDividerCombination[] {
	const e24Cache = get(e24CacheStore)!;
	const e96Cache = get(e96CacheStore)!;
	const e192Cache = get(e192CacheStore)!;

	let heap = new FixedReverseHeap<VoltageDividerCombination>(
		Array,
		(a, b) => a.percentDiff - b.percentDiff,
		20
	) as any as Peekable<VoltageDividerCombination>;

	function run(cache: Cache, eSeries: ESeries) {
		const noFilter = eSeries === 24 || eSeries === 96 || eSeries === 192;
		let [lo, hi] = decadeBounds(cache, -3, 7);

		for (let i = lo; i <= hi; i++) {
			const r1 = cache.resistorValues[i];
			if (!noFilter && !isValueBaseInEseries(r1, eSeries)) {
				continue
			}

			const r2Target = (r1 * targetVout) / (vin - targetVout);
			let index = binarySearch(cache.resistorValues, r2Target, lo, hi);

			let scanned = 0, yielded = 0, left = index - 1;
			while (yielded < 5 && scanned < 256 && left >= lo) {
				const r2 = cache.resistorValues[left];
				const outputImpedance = (r1 * r2) / (r1 + r2);
				if (outputImpedance > maxOutputImpedance) {
					left--; scanned++;
					continue;
				}
				
				if (!noFilter && !isValueBaseInEseries(r2, eSeries)) {
					left--; scanned++;
					continue;
				}

				const impedance = r1 + r2;
				if (impedance > maxImpedance) {
					left--; scanned++;
					continue;
				}
				// impedance will only keep decreasing
				if (impedance < minImpedance) {
					break;
				}

				const vout = vin * r2 / (r1 + r2);
				const percentDiff = MathUtil.percentageDifference(targetVout, vout);

				if (heap.size < 20 || heap.peek()!.percentDiff > percentDiff) {
					heap.push({
						top: {
							type: 'single',
							v1: r1,
						},
						bottom: {
							type: 'single',
							v1: r2
						},
						outputImpedance,
						totalImpedance: impedance,
						current: vin / (r1 + r2),
						vin,
						vout,
						percentDiff,
						eSeries,
					});

					yielded++;
				}

				left--; scanned++;
			}

			let right = index;
			scanned = 0, yielded = 0;
			while (yielded < 5 && scanned < 256 && right <= hi) {
				const r2 = cache.resistorValues[right];
				const outputImpedance = (r1 * r2) / (r1 + r2);
				if (outputImpedance > maxOutputImpedance) {
					break;
				}

				if (!noFilter && !isValueBaseInEseries(r2, eSeries)) {
					right++; scanned++;
					continue
				}

				const impedance = r1 + r2;
				// impedance will only keep increasing
				if (impedance > maxImpedance) {
					break;
				}
				if (impedance < minImpedance) {
					right++; scanned++;
					continue;
				}

				const vout = vin * r2 / (r1 + r2);
				const percentDiff = MathUtil.percentageDifference(targetVout, vout);

				if (heap.size < 20 || heap.peek()!.percentDiff > percentDiff) {
					heap.push({
						top: {
							type: 'single',
							v1: r1,
						},
						bottom: {
							type: 'single',
							v1: r2
						},
						outputImpedance,
						totalImpedance: impedance,
						current: vin / (r1 + r2),
						vin,
						vout,
						percentDiff,
						eSeries,
					});

					yielded++;
				}

				right++; scanned++;
			}
		}
	}

	if (e24Subset) run(e24Cache, e24Subset);
	if (e96Subset) run(e96Cache, e96Subset);
	if (useE192) run(e192Cache, 192);

	return (heap.consume() as Array<VoltageDividerCombination>)
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
			case 3: results = findClosestResistorValuesN3(req.target, req.e24Subset, req.e96Subset, req.useE192); break;
			default: throw Error("invalid n")
		}
		console.log("solve body:", (performance.now() - t).toFixed(2), "ms");
		return results;
	},

	solveVoltageDivider(req: VoltageDividerComputeRequest) {
		let results: VoltageDividerCombination[];
		const t = performance.now();

		let minImpedance, maxImpedance;
		if (req.constraint.type === 'impedance') {
			minImpedance = req.constraint.min, maxImpedance = req.constraint.max;
		} else {
			minImpedance = req.vin / req.constraint.max;
			maxImpedance = req.vin / req.constraint.min;
		}

		switch (req.n) {
			case 2: results = solveVoltageDividerN2(req.vin, req.vout, req.maxOutputImpedance, minImpedance, maxImpedance, req.e24Subset, req.e96Subset, req.useE192); break;
			default: throw Error("invalid n")
		}
		console.log("solve body:", (performance.now() - t).toFixed(2), "ms");
		return results;
	}
}

if (typeof WorkerGlobalScope !== 'undefined' &&
	self instanceof WorkerGlobalScope
) {
	expose(api);
}
export type SolverAPI = typeof api;
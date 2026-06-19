import { MathUtil } from "$lib/math";
import { e192CacheStore, e24CacheStore, e96CacheStore, type Cache } from "$lib/stores/cache";
import { FixedReverseHeap } from "mnemonist";
import { get } from "svelte/store";
import { type E96Subset, type E24Subset, type ESeries, isValueBaseInEseries } from "../../eseries";
import { decadeBounds, binarySearch, type Peekable, binarySearchWithIndices, compareCombinations } from "./util";

type ArmSingle = { type: 'single'; v1: number };
type ArmMulti = { type: 'series' | 'parallel'; v1: number; v2: number };

export type VoltageDividerCombination = {
	outputImpedance: number;
	totalImpedance: number;
	current: number;
	vin: number;
	vout: number;
	percentDiff: number;
	eSeries: ESeries;
} & (
	| { top: ArmSingle; bottom: ArmSingle | ArmMulti }
	| { top: ArmMulti; bottom: ArmSingle } 
);

export function solveVoltageDividerN2(
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
				continue;
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
						top: { type: 'single', v1: r1 },
						bottom: { type: 'single', v1: r2 },
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
					continue;
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
						top: { type: 'single', v1: r1 },
						bottom: { type: 'single', v1: r2 },
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

const indexScratch = new Uint32Array(20);
export function solveVoltageDividerN3(
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

		function collectClosestMatches(
			sortedIndices: Uint32Array,
			values: Float32Array,
			r2Target: number,
			r1: number,
		) {
			let index = binarySearchWithIndices(sortedIndices, values, r2Target);
			let count = 0;

			let scanned = 0, yielded = 0, left = index - 1;
			while (yielded < 5 && scanned < 256 && left >= 0) {
				const sortedIndex = sortedIndices[left];
				const r2 = values[sortedIndex];
				const outputImpedance = (r1 * r2) / (r1 + r2);
				
				if (outputImpedance > maxOutputImpedance) {
					left--; scanned++;
					continue;
				}

				const totalImpedance = r1 + r2;
				if (totalImpedance > maxImpedance) {
					left--; scanned++;
					continue;
				}
				if (totalImpedance < minImpedance) {
					break;
				}

				if (!noFilter && !(isValueBaseInEseries(cache.r1s[sortedIndex], eSeries) && isValueBaseInEseries(cache.r2s[sortedIndex], eSeries))) {
					left--; scanned++;
					continue;
				}

				indexScratch[count++] = sortedIndex;
				left--; scanned++;
				yielded++;
			}

			let right = index;
			scanned = 0, yielded = 0;
			while (yielded < 5 && scanned < 256 && right < sortedIndices.length) {
				const sortedIndex = sortedIndices[right];
				const r2 = values[sortedIndex];
				const outputImpedance = (r1 * r2) / (r1 + r2);
				if (outputImpedance > maxOutputImpedance) {
					break;
				}
				
				const totalImpedance = r1 + r2;
				if (totalImpedance < minImpedance) {
					right++; scanned++;
					continue;
				}
				if (totalImpedance > maxImpedance) {
					break;
				}
				
				if (!noFilter && !(isValueBaseInEseries(cache.r1s[sortedIndex], eSeries) && isValueBaseInEseries(cache.r2s[sortedIndex], eSeries))) {
					right++; scanned++;
					continue;
				}

				indexScratch[count++] = sortedIndex;
				right++; scanned++;
				yielded++;
			}

			return count;
		}

		for (let i = lo; i <= hi; i++) {
			const r1 = cache.resistorValues[i];
			if (!noFilter && !isValueBaseInEseries(r1, eSeries)) {
				continue;
			}

			const r2Target = (r1 * targetVout) / (vin - targetVout);
			
			let count = collectClosestMatches(cache.sortedSeriesIndices, cache.seriesResults, r2Target, r1);
			for (let j = 0; j < count; j++) {
				const r2 = cache.seriesResults[indexScratch[j]];
				const vout = vin * r2 / (r1 + r2);
				const outputImpedance = (r1 * r2) / (r1 + r2);
				const percentDiff = MathUtil.percentageDifference(targetVout, vout);

				if (heap.size < 20 || heap.peek()!.percentDiff > percentDiff) {
					heap.push({
						top: { type: 'single', v1: r1 },
						bottom: { type: 'series', v1: cache.r1s[indexScratch[j]], v2: cache.r2s[indexScratch[j]] },
						outputImpedance,
						totalImpedance: r1 + r2,
						current: vin / (r1 + r2),
						vin,
						vout,
						percentDiff,
						eSeries,
					});
				}
			}

			count = collectClosestMatches(cache.sortedParallelIndices, cache.parallelResults, r2Target, r1);
			for (let j = 0; j < count; j++) {
				const r2 = cache.parallelResults[indexScratch[j]];
				const vout = vin * r2 / (r1 + r2);
				const outputImpedance = (r1 * r2) / (r1 + r2);
				const percentDiff = MathUtil.percentageDifference(targetVout, vout);

				if (heap.size < 20 || heap.peek()!.percentDiff > percentDiff) {
					heap.push({
						top: { type: 'single', v1: r1 },
						bottom: { type: 'parallel', v1: cache.r1s[indexScratch[j]], v2: cache.r2s[indexScratch[j]] },
						outputImpedance,
						totalImpedance: r1 + r2,
						current: vin / (r1 + r2),
						vin,
						vout,
						percentDiff,
						eSeries,
					});
				}
			}


			const r1Target = (r1 * (vin - targetVout)) / targetVout;

			count = collectClosestMatches(cache.sortedSeriesIndices, cache.seriesResults, r1Target, r1);
			for (let j = 0; j < count; j++) {
				const rTop = cache.seriesResults[indexScratch[j]];
				const vout = vin * r1 / (rTop + r1);
				const outputImpedance = (rTop * r1) / (rTop + r1);
				const percentDiff = MathUtil.percentageDifference(targetVout, vout);

				if (heap.size < 20 || heap.peek()!.percentDiff > percentDiff) {
					heap.push({
						top: { type: 'series', v1: cache.r1s[indexScratch[j]], v2: cache.r2s[indexScratch[j]] },
						bottom: { type: 'single', v1: r1 },
						outputImpedance,
						totalImpedance: rTop + r1,
						current: vin / (rTop + r1),
						vin,
						vout,
						percentDiff,
						eSeries,
					});
				}
			}

			count = collectClosestMatches(cache.sortedParallelIndices, cache.parallelResults, r1Target, r1);
			for (let j = 0; j < count; j++) {
				const rTop = cache.parallelResults[indexScratch[j]];
				const vout = vin * r1 / (rTop + r1);
				const outputImpedance = (rTop * r1) / (rTop + r1);
				const percentDiff = MathUtil.percentageDifference(targetVout, vout);

				if (heap.size < 20 || heap.peek()!.percentDiff > percentDiff) {
					heap.push({
						top: { type: 'parallel', v1: cache.r1s[indexScratch[j]], v2: cache.r2s[indexScratch[j]] },
						bottom: { type: 'single', v1: r1 },
						outputImpedance,
						totalImpedance: rTop + r1,
						current: vin / (rTop + r1),
						vin,
						vout,
						percentDiff,
						eSeries,
					});
				}
			}
		}
	}

	if (e24Subset) run(e24Cache, e24Subset);
	if (e96Subset) run(e96Cache, e96Subset);
	if (useE192) run(e192Cache, 192);

	let n2Results = solveVoltageDividerN2(vin, targetVout, maxOutputImpedance, minImpedance, maxImpedance, e24Subset, e96Subset, useE192);
	for (const r of n2Results) {
		heap.push(r);
	}

	return (heap.consume() as Array<VoltageDividerCombination>).sort(compareCombinations);
}
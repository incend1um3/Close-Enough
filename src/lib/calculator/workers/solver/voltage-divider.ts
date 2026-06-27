import { MathUtil } from "$lib/math";
import { e192CacheStore, e24CacheStore, e96CacheStore, pickCacheFromESeries, type Cache } from "$lib/stores/cache";
import { FixedReverseHeap } from "mnemonist";
import { get } from "svelte/store";
import { type E96Subset, type E24Subset, type ESeries, isValueBaseInEseries } from "../../eseries";
import { decadeBounds, binarySearch, type Peekable, binarySearchWithIndices, compareCombinations } from "./util";
import { Maybe } from "true-myth";

type ArmSingle = { type: 'single'; v1: number };
type ArmMulti = { type: 'series' | 'parallel'; v1: number; v2: number };
type VoltageDividerArms = { top: ArmSingle; bottom: ArmSingle | ArmMulti } | { top: ArmMulti; bottom: ArmSingle };

export type VoltageDividerCombination = {
	outputImpedance: number;
	totalImpedance: number;
	current: number;
	vin: number;
	vout: number;
	percentDiff: number;
	eSeries: ESeries;
} & VoltageDividerArms;

function computeResistanceOfArm(arm: ArmSingle | ArmMulti) {
	if (arm.type === "single") {
		return arm.v1;
	} else if (arm.type === "series") {
		return arm.v1 + arm.v2;
	} else {
		return MathUtil.parallelResistance(arm.v1, arm.v2);
	}
}

function _computeOutputVoltageFromArms(vin: number, arms: VoltageDividerArms) {
	const rTop = computeResistanceOfArm(arms.top);
	const rBot = computeResistanceOfArm(arms.bottom);
	return vin * rBot / (rTop + rBot);
}

function getDividerSignature(arms: VoltageDividerArms) {
	function getArmSig(arm: ArmSingle | ArmMulti) {
		if (arm.type === 'single') {
			return arm.v1;
		} else {
			return arm.v1 > arm.v2 ? `${arm.v2},${arm.v1}` : `${arm.v1},${arm.v2}`;
		}
	}

	return `${getArmSig(arms.top)}|${getArmSig(arms.bottom)}`
}

export function solveVoltageDividerN2(
	vin: number,
	targetVout: number,
	maxOutputImpedance: number,
	minImpedance: number,
	maxImpedance: number,
	pinnedR1: Maybe<number>,
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

	const YIELD = 15;

	function run(cache: Cache, eSeries: ESeries) {
		const noFilter = eSeries === 24 || eSeries === 96 || eSeries === 192;
		let [lo, hi] = decadeBounds(cache, -3, 7);

		for (let i = lo; i <= hi; i++) {
			const r1 = pinnedR1.unwrapOr(cache.resistorValues[i]);
			if (pinnedR1.isNothing && !noFilter && !isValueBaseInEseries(r1, eSeries)) {
				continue;
			}

			const r2Target = (r1 * targetVout) / (vin - targetVout);
			let index = binarySearch(cache.resistorValues, r2Target, lo, hi);

			let scanned = 0, yielded = 0, left = index - 1;
			while (yielded < YIELD && scanned < 256 && left >= lo) {
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
			while (yielded < YIELD && scanned < 256 && right <= hi) {
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
			
			if (pinnedR1.isJust) break;
		}

		if (pinnedR1.isJust) {
			const r2 = pinnedR1.value;
			const r1Target = (r2 * (vin - targetVout)) / targetVout;
			const index = binarySearch(cache.resistorValues, r1Target, lo, hi);

			let scanned = 0, yielded = 0, left = index - 1;
			while (yielded < YIELD && scanned < 256 && left >= lo) {
				const r1 = cache.resistorValues[left];
				const outputImpedance = (r1 * r2) / (r1 + r2);
				if (outputImpedance > maxOutputImpedance) {
					left--; scanned++;
					continue;
				}

				if (!noFilter && !isValueBaseInEseries(r1, eSeries)) {
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
			while (yielded < YIELD && scanned < 256 && right <= hi) {
				const r1 = cache.resistorValues[right];
				const outputImpedance = (r1 * r2) / (r1 + r2);
				if (outputImpedance > maxOutputImpedance) {
					break;
				}

				if (!noFilter && !isValueBaseInEseries(r1, eSeries)) {
					right++; scanned++;
					continue;
				}

				const impedance = r1 + r2;
				if (impedance > maxImpedance) {
					// impedance will only keep increasing
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
	pinnedR1: Maybe<number>,
	pinnedR2: Maybe<number>,
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

	if (pinnedR1.isNothing && pinnedR2.isJust) {
		pinnedR1 = Maybe.of(pinnedR2.value);
		pinnedR2 = Maybe.nothing();
	}
	const numPinned = pinnedR1.isJust && pinnedR2.isJust ? 2 : pinnedR1.isJust ? 1 : 0;

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
			const r1 = numPinned === 1 ? pinnedR1.unwrapOr(NaN) : cache.resistorValues[i];
			if (pinnedR1.isNothing && !noFilter && !isValueBaseInEseries(r1, eSeries)) {
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

			if (numPinned === 1) break;
		}
	}

	if (numPinned < 2) {
		if (e24Subset) run(e24Cache, e24Subset);
		if (e96Subset) run(e96Cache, e96Subset);
		if (useE192) run(e192Cache, 192);
	} else {
		if (e24Subset) solveVoltageDividerN3Pinned2(vin, targetVout, maxOutputImpedance, minImpedance, maxImpedance, pinnedR1.unwrapOr(NaN), pinnedR2.unwrapOr(NaN), e24Subset, heap);
		if (e96Subset) solveVoltageDividerN3Pinned2(vin, targetVout, maxOutputImpedance, minImpedance, maxImpedance, pinnedR1.unwrapOr(NaN), pinnedR2.unwrapOr(NaN), e96Subset, heap);
		if (useE192) solveVoltageDividerN3Pinned2(vin, targetVout, maxOutputImpedance, minImpedance, maxImpedance, pinnedR1.unwrapOr(NaN), pinnedR2.unwrapOr(NaN), 192, heap);
	}

	if (numPinned === 1) {
		if (e24Subset) solveVoltageDividerN3Pinned1(vin, targetVout, maxOutputImpedance, minImpedance, maxImpedance, pinnedR1.unwrapOr(NaN), e24Subset, heap);
		if (e96Subset) solveVoltageDividerN3Pinned1(vin, targetVout, maxOutputImpedance, minImpedance, maxImpedance, pinnedR1.unwrapOr(NaN), e96Subset, heap);
		if (useE192) solveVoltageDividerN3Pinned1(vin, targetVout, maxOutputImpedance, minImpedance, maxImpedance, pinnedR1.unwrapOr(NaN), 192, heap);
	}

	if (numPinned < 2) {
		let n2Results = solveVoltageDividerN2(vin, targetVout, maxOutputImpedance, minImpedance, maxImpedance, pinnedR1, e24Subset, e96Subset, useE192);
		for (const r of n2Results) {
			heap.push(r);
		}
	}

	return (heap.consume() as Array<VoltageDividerCombination>).sort(compareCombinations);
}

// Does not cover cases where pinned R is a single arm
export function solveVoltageDividerN3Pinned1(
	vin: number,
	targetVout: number,
	maxOutputImpedance: number,
	minImpedance: number,
	maxImpedance: number,
	pinnedR1: number,
	eSeries: ESeries,
	heap: Peekable<VoltageDividerCombination>,
) {
	const YIELD = 20;
	const cache = pickCacheFromESeries(eSeries)!;
	const noFilter = eSeries === 24 || eSeries === 96 || eSeries === 192;
	const [lo, hi] = decadeBounds(cache, -1, 7);

	function collectClosestMatches(
		target: number,
		constructArms: (r3: number) => VoltageDividerArms,
	) {
		if (isNaN(target) || !isFinite(target) || target <= 0) {
			return;
		}

		let index = binarySearch(cache.resistorValues, target, lo, hi);

		let scanned = 0, yielded = 0, left = index - 1;
		while (yielded < YIELD && scanned < 256 && left >= lo) {
			const r3 = cache.resistorValues[left];
			const arms = constructArms(r3);
			const rTop = computeResistanceOfArm(arms.top);
			const rBottom = computeResistanceOfArm(arms.bottom);

			const outputImpedance = MathUtil.parallelResistance(rTop, rBottom);
			if (outputImpedance > maxOutputImpedance) {
				left--; scanned++;
				continue;
			}

			if (!noFilter && !isValueBaseInEseries(r3, eSeries)) {
				left--; scanned++;
				continue;
			}

			const impedance = rTop + rBottom;
			if (impedance > maxImpedance) {
				left--; scanned++;
				continue;
			}
			// impedance will only keep decreasing
			if (impedance < minImpedance) {
				break;
			}

			const vout = vin * rBottom / (rTop + rBottom);
			const percentDiff = MathUtil.percentageDifference(targetVout, vout);

			if (heap.size < 20 || heap.peek()!.percentDiff > percentDiff) {
				heap.push({
					...arms,
					outputImpedance,
					totalImpedance: impedance,
					current: vin / impedance,
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
		while (yielded < YIELD && scanned < 256 && right <= hi) {
			const r3 = cache.resistorValues[right];
			const arms = constructArms(r3);
			const rTop = computeResistanceOfArm(arms.top);
			const rBottom = computeResistanceOfArm(arms.bottom);

			const outputImpedance = MathUtil.parallelResistance(rTop, rBottom);
			if (outputImpedance > maxOutputImpedance) {
				break;
			}

			if (!noFilter && !isValueBaseInEseries(r3, eSeries)) {
				right++; scanned++;
				continue;
			}

			const impedance = rTop + rBottom;
			if (impedance > maxImpedance) {
				// impedance will only keep increasing
				break;
			}
			if (impedance < minImpedance) {
				right++; scanned++;
				continue;
			}

			const vout = vin * rBottom / (rTop + rBottom);
			const percentDiff = MathUtil.percentageDifference(targetVout, vout);

			if (heap.size < 20 || heap.peek()!.percentDiff > percentDiff) {
				heap.push({
					...arms,
					outputImpedance,
					totalImpedance: impedance,
					current: vin / impedance,
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

	for (const r3PairTopology of ["series", "parallel"] as ("series" | "parallel")[]) {
		for (let i = lo; i <= hi; i++) {
			const r2 = cache.resistorValues[i];
			if (!noFilter && !isValueBaseInEseries(r2, eSeries)) continue;

			const computeR3 = (arm: number) =>
				r3PairTopology === "series"
					? arm - pinnedR1
					: (arm * pinnedR1) / (pinnedR1 - arm);


			collectClosestMatches(
				computeR3(r2 * (vin - targetVout) / targetVout),
				r3 => ({
					top: { type: r3PairTopology, v1: pinnedR1, v2: r3 },
					bottom: { type: 'single', v1: r2 }
				})
			);

			collectClosestMatches(
				computeR3(r2 * targetVout / (vin - targetVout)),
				r3 => ({
					top: { type: 'single', v1: r2 },
					bottom: { type: r3PairTopology, v1: pinnedR1, v2: r3 },
				})
			);
		}
	}
}

export function solveVoltageDividerN3Pinned2(
	vin: number,
	targetVout: number,
	maxOutputImpedance: number,
	minImpedance: number,
	maxImpedance: number,
	r1: number,
	r2: number,
	eSeries: ESeries,
	heap: Peekable<VoltageDividerCombination>,
) {
	const YIELD = 20;

	const cache = pickCacheFromESeries(eSeries)!;
	const noFilter = eSeries === 24 || eSeries === 96 || eSeries === 192;
	const [lo, hi] = decadeBounds(cache, -1, 7);

	// Dedup pairs like (R1 + R2||R3) / (R1 + R3||R2)
	const dividerSignatures = new Set<string>();

	function collectClosestMatches(
		target: number, 
		constructArms: (r3: number) => VoltageDividerArms,
	) {
		if (isNaN(target) || !isFinite(target) || target <= 0) {
			return;
		}

		let index = binarySearch(cache.resistorValues, target, lo, hi);

		let scanned = 0, yielded = 0, left = index - 1;
		while (yielded < YIELD && scanned < 256 && left >= lo) {
			const r3 = cache.resistorValues[left];
			const arms = constructArms(r3);
			const sig = getDividerSignature(arms);
			if (dividerSignatures.has(sig)) {
				left--; scanned++;
				continue;
			}

			const rTop = computeResistanceOfArm(arms.top);
			const rBottom = computeResistanceOfArm(arms.bottom);

			const outputImpedance = MathUtil.parallelResistance(rTop, rBottom);
			if (outputImpedance > maxOutputImpedance) {
				left--; scanned++;
				continue;
			}

			if (!noFilter && !isValueBaseInEseries(r3, eSeries)) {
				left--; scanned++;
				continue;
			}

			const impedance = rTop + rBottom;
			if (impedance > maxImpedance) {
				left--; scanned++;
				continue;
			}
			// impedance will only keep decreasing
			if (impedance < minImpedance) {
				break;
			}

			const vout = vin * rBottom / (rTop + rBottom);
			const percentDiff = MathUtil.percentageDifference(targetVout, vout);

			if (heap.size < 20 || heap.peek()!.percentDiff > percentDiff) {
				heap.push({
					...arms,
					outputImpedance,
					totalImpedance: impedance,
					current: vin / impedance,
					vin,
					vout,
					percentDiff,
					eSeries,
				});
				dividerSignatures.add(sig);
				yielded++;
			}

			left--; scanned++;
		}

		let right = index;
		scanned = 0, yielded = 0;
		while (yielded < YIELD && scanned < 256 && right <= hi) {
			const r3 = cache.resistorValues[right];
			const arms = constructArms(r3);
			const sig = getDividerSignature(arms);
			if (dividerSignatures.has(sig)) {
				right++; scanned++;
				continue;
			}

			const rTop = computeResistanceOfArm(arms.top);
			const rBottom = computeResistanceOfArm(arms.bottom);

			const outputImpedance = MathUtil.parallelResistance(rTop, rBottom);
			if (outputImpedance > maxOutputImpedance) {
				break;
			}

			if (!noFilter && !isValueBaseInEseries(r3, eSeries)) {
				right++; scanned++;
				continue;
			}

			const impedance = rTop + rBottom;
			if (impedance > maxImpedance) {
				// impedance will only keep increasing
				break;
			}
			if (impedance < minImpedance) {
				right++; scanned++;
				continue;
			}

			const vout = vin * rBottom / (rTop + rBottom);
			const percentDiff = MathUtil.percentageDifference(targetVout, vout);

			if (heap.size < 20 || heap.peek()!.percentDiff > percentDiff) {
				heap.push({
					...arms,
					outputImpedance,
					totalImpedance: impedance,
					current: vin / impedance,
					vin,
					vout,
					percentDiff,
					eSeries,
				});
				dividerSignatures.add(sig);
				yielded++;
			}

			right++; scanned++;
		}
	}

	for (const r1r2Topology of ["series", "parallel"] as ('series' | 'parallel')[]) {
		const r1r2 = r1r2Topology === "series" ? r1 + r2 : r1 * r2 / (r1 + r2);
		
		collectClosestMatches(
			r1r2 * (vin - targetVout) / targetVout,
			r3 => ({
				top: { type: "single", v1: r3 },
				bottom: { type: r1r2Topology, v1: r1, v2: r2 },
			})
		);
		collectClosestMatches(
			r1r2 * targetVout / (vin - targetVout),
			r3 => ({
				top: { type: r1r2Topology, v1: r1, v2: r2 },
				bottom: { type: "single", v1: r3 },
			})
		);
	}

	for (const r3PairTopology of ["series", "parallel"] as ('series' | 'parallel')[]) {
		for (const [r1Swapped, r2Swapped] of [[r1, r2], [r2, r1]]) {
			const computeR3 = (arm: number) =>
				r3PairTopology === "series"
					? arm - r2Swapped
					: arm * r2Swapped / (r2Swapped - arm);

			collectClosestMatches(
				computeR3(r1Swapped * targetVout / (vin - targetVout)),
				r3 => ({
					top: { type: "single", v1: r1Swapped },
					bottom: { type: r3PairTopology, v1: r2Swapped, v2: r3 },
				})
			);
			collectClosestMatches(
				computeR3(r1Swapped * (vin - targetVout) / targetVout),
				r3 => ({
					top: { type: r3PairTopology, v1: r2Swapped, v2: r3 },
					bottom: { type: "single", v1: r1Swapped },
				})
			);
		}
	}
}
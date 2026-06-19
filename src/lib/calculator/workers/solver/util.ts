import { MathUtil } from "$lib/math";
import { type Cache } from "$lib/stores/cache";
import { FixedReverseHeap } from "mnemonist";
import { isValueBaseInEseries, type ESeries } from "../../eseries";
import type { Combination } from "./resistor";
import type { VoltageDividerCombination } from "./voltage-divider";
import { isCombinationVoltageDivider } from "$lib/util";

export const ONE_MILLI = 1e-3;

export type Peekable<T> = FixedReverseHeap<T> & { peek(): T | undefined };

const START_DECADE = -1;

export function decadeBounds(cache: Cache, minDecade: number, maxDecade: number) {
	const basesLen = cache.eSeries;
	const lo = Math.max(0, (minDecade - START_DECADE)) * basesLen;
	const hi = Math.min(cache.resistorValues.length - 1, (maxDecade - START_DECADE + 1) * basesLen);
	return [lo, hi] as const;
}

export function binarySearch(values: Float32Array, x: number, head = 0, tail: number = values.length - 1): number {
	while (head <= tail) {
		let mid = (head + tail) >>> 1;
		let value = values[mid];
		if (value === x) return mid;
		if (value > x) tail = mid - 1;
		else head = mid + 1;
	}

	if (tail < 0) return head;
	if (head >= values.length) return tail;

	const headVal = values[head];
	const tailVal = values[tail];
	return Math.abs(headVal - x) <= Math.abs(tailVal - x) ? head : tail;
}

export function binarySearchWithIndices(sortedIndices: Uint32Array, values: Float32Array, x: number): number {
	if (sortedIndices.length !== values.length) throw new Error("array lengths of indices and values must match!");

	let head = 0, tail = values.length - 1;
	while (head <= tail) {
		let mid = (head + tail) >>> 1;
		let value = values[sortedIndices[mid]];
		if (value === x) return mid;
		if (value > x) tail = mid - 1;
		else head = mid + 1;
	}

	if (tail < 0) return head;
	if (head >= sortedIndices.length) return tail;

	const headVal = values[sortedIndices[head]];
	const tailVal = values[sortedIndices[tail]];
	return Math.abs(headVal - x) <= Math.abs(tailVal - x) ? head : tail;
}

export function* closestCombinations(cache: Cache, combinationArray: 'series' | 'parallel', eSeries: ESeries, target: number) {
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

export function numComponents(c: Combination | VoltageDividerCombination): number {
	function runOnType(t: any) {
		switch (t) {
			case 'single': return 1;
			case 'series':
			case 'parallel': return 2;
			default: return 3;
		}
	}

	if (!isCombinationVoltageDivider(c)) {
		return runOnType(c.type)
	} else {
		return runOnType(c.top.type) + runOnType(c.bottom.type);
	}
}

export function compareCombinations(a: Combination | VoltageDividerCombination, b: Combination | VoltageDividerCombination): number {
	if (Math.abs(a.percentDiff - b.percentDiff) > 1e-6) return a.percentDiff - b.percentDiff;
	return numComponents(a) - numComponents(b);
}
import { eSeriesBaseFromValue, isBaseInESeries, isValueBaseInEseries, type CachedESeries, type ESeries } from "$lib/calculator/eseries";
import { get, writable } from "svelte/store";

export type Cache = { 
	eSeries: CachedESeries;
	sortedSeriesIndices: Uint32Array,
	sortedParallelIndices: Uint32Array,
	seriesResults: Float32Array,
	parallelResults: Float32Array,
	r1s: Float32Array,
	r2s: Float32Array,
	resistorValues: Float32Array,
};

export const e24CacheStore = writable<Cache | null>(null);
export const e96CacheStore = writable<Cache | null>(null);
export const e192CacheStore = writable<Cache | null>(null);

export function pickCacheFromESeries(eSeries: ESeries) {
	if (eSeries <= 24) {
		return get(e24CacheStore);
	} else if (eSeries <= 96) {
		return get(e96CacheStore);
	} else {
		return get(e192CacheStore);
	}
}

export function* iterResistorValuesFromCache(eSeries: ESeries) {
	let cache = pickCacheFromESeries(eSeries)!;

	const count = cache.r1s.length;
	const n = Math.round((-1 + Math.sqrt(1 + 8 * count)) / 2);

	if (eSeries === 24 || eSeries === 96 || eSeries === 192) {
		for (let a = 0; a < n; a++) {
			yield cache.r1s[a * n - (a * (a - 1)) / 2];
		}
	} else {
		for (let a = 0; a < n; a++) {
			let value = cache.r1s[a * n - (a * (a - 1)) / 2];
			const base = eSeriesBaseFromValue(value);
			if (isBaseInESeries(base, eSeries)) {
				yield value;
			}
		}
	}
}

export function* iterCombinationsFromCacheUnsorted(eSeries: ESeries, type: 'series' | 'parallel') {
	let cache = pickCacheFromESeries(eSeries)!;

	const combinations = type === 'series' ? cache.seriesResults : cache.parallelResults;

	if (eSeries === 24 || eSeries === 96 || eSeries === 192) {
		for (let i = 0; i < cache.r1s.length; i++) {
			yield {
				r1: cache.r1s[i],
				r2: cache.r2s[i],
				result: combinations[i]
			}
		}
	} else {
		for (let i = 0; i < cache.r1s.length; i++) {
			let r1 = cache.r1s[i];
			let r2 = cache.r2s[i];
			if (isValueBaseInEseries(r1, eSeries) && isValueBaseInEseries(r2, eSeries)) {
				yield {
					r1: cache.r1s[i],
					r2: cache.r2s[i],
					result: combinations[i]
				}
			}
		}
	}

}

export function* iterSeriesValues(cache: Cache) {
	for (let index of cache.sortedSeriesIndices) {
		yield { index, value: cache.seriesResults[index] }
	}
}

export function* iterParallelValues(cache: Cache) {
	for (let index of cache.sortedParallelIndices) {
		yield { index, value: cache.parallelResults[index] }
	}
}

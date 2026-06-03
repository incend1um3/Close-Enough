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

	if (eSeries === 24 || eSeries === 96 || eSeries === 192) {
		for (const r of cache.resistorValues) {
			yield r;
		}
	} else {
		for (const r of cache.resistorValues) {
			if (isValueBaseInEseries(r, eSeries)) {
				yield r;
			}
		}
	}
}

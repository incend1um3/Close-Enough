/// <reference lib="webworker" />

import { MathUtil } from "$lib/math";
import { type Cache } from "$lib/stores/cache";
import { generateESeriesValues, type CachedESeries, type ESeries } from "../eseries";
import type { Result } from "true-myth";
import { err, ok } from "true-myth/result";

const CACHE_VERSION = 2;
const OPFS_DIR = `precomputed-v${CACHE_VERSION}`;

function radixSortIndices(values: Float32Array): Uint32Array {
	const n = values.length;
	const src = new Uint32Array(values.buffer, values.byteOffset, n);

	let keys = src.slice();              // sequential keys, reordered each pass
	let keysTmp = new Uint32Array(n);
	let idx = new Uint32Array(new SharedArrayBuffer(n * 4));
	for (let i = 0; i < n; i++) idx[i] = i;
	let idxTmp = new Uint32Array(new SharedArrayBuffer(n * 4));

	// All four histograms in ONE pass (order-independent)
	const c0 = new Int32Array(256), c1 = new Int32Array(256);
	const c2 = new Int32Array(256), c3 = new Int32Array(256);
	for (let i = 0; i < n; i++) {
		const k = keys[i];
		c0[k & 0xff]++;
		c1[(k >>> 8) & 0xff]++;
		c2[(k >>> 16) & 0xff]++;
		c3[(k >>> 24) & 0xff]++;
	}
	const counts = [c0, c1, c2, c3];
	for (const c of counts)
		for (let i = 1; i < 256; i++) c[i] += c[i - 1];

	for (let pass = 0; pass < 4; pass++) {
		const shift = pass * 8;
		const c = counts[pass];
		for (let i = n - 1; i >= 0; i--) {
			const k = keys[i];
			const pos = --c[(k >>> shift) & 0xff];
			keysTmp[pos] = k;
			idxTmp[pos] = idx[i];
		}
		[keys, keysTmp] = [keysTmp, keys];
		[idx, idxTmp] = [idxTmp, idx];
	}

	return idx;
}

function generateResistorCombinations(resistors: number[]) {
	const n_r = resistors.length;
	const count = n_r * (n_r + 1) / 2;

	const seriesResults = new Float32Array(new SharedArrayBuffer(count * 4));
	const parallelResults = new Float32Array(new SharedArrayBuffer(count * 4));
	const r1s = new Float32Array(new SharedArrayBuffer(count * 4));
	const r2s = new Float32Array(new SharedArrayBuffer(count * 4));

	let i = 0;
	for (let a = 0; a < n_r; a++) {
		for (let b = a; b < n_r; b++) {
			const r1 = resistors[a];
			const r2 = resistors[b];

			seriesResults[i] = r1 + r2;
			parallelResults[i] = (r1 * r2) / (r1 + r2);
			r1s[i] = r1;
			r2s[i] = r2;

			i += 1;
		}
	}

	return [radixSortIndices(seriesResults), radixSortIndices(parallelResults), seriesResults, parallelResults, r1s, r2s]
}

function generateResistorCombinationsForESeries(eSeries: CachedESeries) {
	let values = generateESeriesValues(eSeries, -1, 7);
	let combInfo = generateResistorCombinations(values);

	let results = {
		eSeries,
		sortedSeriesIndices: combInfo[0] as Uint32Array,
		sortedParallelIndices: combInfo[1] as Uint32Array,
		seriesResults: combInfo[2] as Float32Array,
		parallelResults: combInfo[3] as Float32Array,
		r1s: combInfo[4] as Float32Array,
		r2s: combInfo[5] as Float32Array,
		resistorValues: new Float32Array(new SharedArrayBuffer(0))
	};

	return results;
}

function serializeCache(c: Cache) {
	const arrays = [
		c.sortedSeriesIndices,
		c.sortedParallelIndices,
		c.seriesResults,
		c.parallelResults,
		c.r1s,
		c.r2s,
	];

	const headerBytes = 4; // cache version
	const dataBytes = arrays.map(a => a.byteLength).reduce((acc, l) => acc + l, 0) + arrays.length * 4 + 4;
	const totalBytes = headerBytes + dataBytes;
	let bytes = new Uint8Array(totalBytes);
	const view = new DataView(bytes.buffer);

	// Encode header
	view.setUint32(0, CACHE_VERSION, true);

	// Encoder E-Series
	view.setUint32(4, c.eSeries, true);

	// encode data
	let offset = 8;
	for (const arr of arrays) {
		view.setUint32(offset, arr.length, true);
		offset += 4;

		bytes.set(new Uint8Array(arr.buffer, arr.byteOffset, arr.byteLength), offset);
		offset += arr.byteLength;
	}

	return bytes;
}

function deserializeCache(bytes: Uint8Array<SharedArrayBuffer>): Result<Cache, unknown> {
	const view = new DataView(bytes.buffer);
	const cacheVersion = view.getUint32(0, true);

	if (cacheVersion !== CACHE_VERSION) {
		return err();
	}

	const eSeries = view.getUint32(4, true) as CachedESeries;
	let offset = 8;

	function nextUint32Array() {
		let len = view.getUint32(offset, true);
		offset += 4;

		const arr = new Uint32Array(bytes.buffer, offset, len);
		offset += arr.byteLength;

		return arr;
	}

	function nextFloat32Array() {
		let len = view.getUint32(offset, true);
		offset += 4;

		const arr = new Float32Array(bytes.buffer, offset, len);
		offset += arr.byteLength;

		return arr;
	}

	return ok({
		eSeries,
		sortedSeriesIndices: nextUint32Array(),
		sortedParallelIndices: nextUint32Array(),
		seriesResults: nextFloat32Array(),
		parallelResults: nextFloat32Array(),
		r1s: nextFloat32Array(),
		r2s: nextFloat32Array(),
		resistorValues: new Float32Array(new SharedArrayBuffer(0)),
	})
}

async function opfsGetCache(key: string) {
	try {
		const root = await navigator.storage.getDirectory();
		const dir = await root.getDirectoryHandle(OPFS_DIR);
		const fh = await dir.getFileHandle(`${key}.bin`);
		const sh = await fh.createSyncAccessHandle();

		const buf = new Uint8Array(new SharedArrayBuffer(sh.getSize()));
		sh.read(buf, { at: 0 });
		sh.close();

		return deserializeCache(buf);
	} catch {
		return err("Failed to deserialize cache"); // directory or file doesn't exist yet
	}
}

async function opfsPutCache(key: string, value: Cache) {
	try {
		const root = await navigator.storage.getDirectory();
		const dir = await root.getDirectoryHandle(OPFS_DIR, { create: true });
		const fh = await dir.getFileHandle(`${key}.bin`, { create: true });
		const sh = await fh.createSyncAccessHandle();

		const serialized = serializeCache(value);
		sh.truncate(0);
		sh.write(serialized.buffer);
		sh.flush();
		sh.close();

		return ok();
	} catch {
		return err("Failed to store cache");
	}
}

async function opfsPurgeOldCache() {
	try {
		const root = await navigator.storage.getDirectory();
		for await (const [name, _] of root.entries()) {
			if (name !== OPFS_DIR) {
				root.removeEntry(name, { recursive: true });
			}
		}
		return ok();
	} catch {
		return err("Failed to purge old cache");
	}
}

function computeResistorValues(r1s: Float32Array) {
	const count = r1s.length;
	const n = MathUtil.inverseTriangularNumber(count);
	let resistorValues = new Float32Array(new SharedArrayBuffer(n * 4));
	
	let i = 0;
	for (let a = 0; a < n; a++) {
		resistorValues[i++] = r1s[a * n - (a * (a - 1)) / 2];
	}

	return resistorValues ;
}

self.onmessage = async (e: MessageEvent<{ eseries: CachedESeries }>) => {
	const cacheKey = `e-${e.data.eseries}`

	const t0 = performance.now();
	const [cached, _] = await Promise.all([opfsGetCache(cacheKey), opfsPurgeOldCache()]);
	const diskMs = performance.now() - t0;

	if (cached.isOk) {
		const t1 = performance.now();
		cached.value.resistorValues = computeResistorValues(cached.value.r1s);
		const computeMs = performance.now() - t1;

		console.log(`[cache HIT] disk=${diskMs.toFixed(2)}ms compute=${computeMs.toFixed(2)}ms`, { cacheKey });
		const t2 = performance.now();
		self.postMessage({ results: cached.value });
		console.log(`[postMessage] transfer=${(performance.now() - t2).toFixed(2)}ms`);
		return;
	} else {
		console.error(`[cache MISS] disk=${diskMs.toFixed(2)}ms`, cached.error);
	}

	const t2 = performance.now();
	let results = generateResistorCombinationsForESeries(e.data.eseries);
	const generateMs = performance.now() - t2;

	const t3 = performance.now();
	results.resistorValues = computeResistorValues(results.r1s);
	const computeMs = performance.now() - t3;

	const t4 = performance.now();
	await opfsPutCache(cacheKey, results);
	const writeMs = performance.now() - t4;

	console.log(`[cache MISS] generate=${generateMs.toFixed(2)}ms compute=${computeMs.toFixed(2)}ms write=${writeMs.toFixed(2)}ms`, { cacheKey });

	const t5 = performance.now();
	self.postMessage({ results });
	console.log(`[postMessage] transfer=${(performance.now() - t5).toFixed(2)}ms`);
}
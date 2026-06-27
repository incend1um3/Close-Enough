import { e24CacheStore, e96CacheStore, e192CacheStore, type Cache } from "$lib/stores/cache";
import { expose } from 'comlink';
import { type ComputeRequest, type VoltageDividerComputeRequest } from "./schemas";
import { type Combination, findClosestResistorValuesN1, findClosestResistorValuesN2, findClosestResistorValuesN3 } from "./resistor";
import { type VoltageDividerCombination, solveVoltageDividerN2, solveVoltageDividerN3 } from "./voltage-divider";
import { Maybe } from "true-myth";

export type { Combination } from "./resistor";
export type { VoltageDividerCombination } from "./voltage-divider";
export { parseComputeRequest, parseVoltageDividerComputeRequest, ComputeRequestSchema, VoltageDividerComputeRequestSchema, type ComputeRequest, type VoltageDividerComputeRequest } from "./schemas";

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
			default: throw Error("invalid n");
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
			case 2: results = solveVoltageDividerN2(req.vin, req.vout, req.maxOutputImpedance, minImpedance, maxImpedance, Maybe.of(req.pinnedR1), req.e24Subset, req.e96Subset, req.useE192); break;
			case 3: results = solveVoltageDividerN3(req.vin, req.vout, req.maxOutputImpedance, minImpedance, maxImpedance, Maybe.of(req.pinnedR1), Maybe.of(req.pinnedR2), req.e24Subset, req.e96Subset, req.useE192); break;
			default: throw Error("invalid n");
		}
		console.log("solve body:", (performance.now() - t).toFixed(2), "ms");
		return results;
	}
};

if (typeof WorkerGlobalScope !== 'undefined' && self instanceof WorkerGlobalScope) {
	expose(api);
}

export type SolverAPI = typeof api;
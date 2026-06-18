import { createContext } from "svelte";
import type { VoltageDividerComputeRequest, ComputeRequest, VoltageDividerCombination, Combination } from "./workers/solver";

export type SolverContext = {
	voltageDivider: {
		computeReq: VoltageDividerComputeRequest,
		inputError: boolean,
		resultsPromise: Promise<VoltageDividerCombination[]> | null,
		solveTime: number,
	},
	resistance: {
		computeReq: ComputeRequest,
		inputError: boolean,
		resultsPromise: Promise<Combination[]> | null,
		solveTime: number,
	}
};

export const [getCalculatorContext, setCalculatorContext] = createContext<SolverContext>();
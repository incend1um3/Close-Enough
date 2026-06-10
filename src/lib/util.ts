import type { Combination, VoltageDividerCombination } from "./calculator/workers/solver";

export function isCombinationVoltageDivider(c: Combination | VoltageDividerCombination): c is VoltageDividerCombination {
	return 'vout' in c;
}

export function getNumComponentsFromCombination(c: Combination | VoltageDividerCombination) {
	if (isCombinationVoltageDivider(c)) {
		if (c.top.type === "single" && c.bottom.type === "single") {
			return 2;
		} else if (c.top.type !== "single" && c.bottom.type !== "single") {
			return 4;
		} else {
			return 3;
		}
	} else {
		switch (c.type) {
			case 'single': return 1;
			case 'series':
			case 'parallel': return 2;
			default: return 3;
		}
	}
}
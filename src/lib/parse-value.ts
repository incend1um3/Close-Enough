/**
 * Parser for RKM-style component values (BS 1852 / IEC 60062).
 *
 * Handles the two notations electronics uses interchangeably:
 *   - letter as decimal point + multiplier:  4K7 -> 4.7k,  4V7 -> 4.7V,  R47 -> 0.47R
 *   - explicit number + suffix:              4.7K -> 4.7k, 4.7V, 4.7uF, 10kΩ, 220R
 *
 * The single letter does double duty: it sets the SI multiplier *and*,
 * when it sits between digits, marks the decimal point.
 */

import type { Result } from "true-myth";
import { err, ok } from "true-myth/result";

export type Unit = "ohm" | "farad" | "volt" | "amp" | "henry" | "unknown";

export interface ParsedValue {
	/** Full value in base units, e.g. 4700 for "4K7". */
	value: number;
	/** Bare number before the multiplier, e.g. 4.7. */
	significand: number;
	/** Multiplier that was applied, e.g. 1000. */
	multiplier: number;
	/** Detected unit (best-effort; pass `defaultUnit` to override inference). */
	unit: Unit;
	/** Original input string. */
	raw: string;
}

const MULTIPLIER: Record<string, number> = {
	p: 1e-12, n: 1e-9, u: 1e-6, "µ": 1e-6, m: 1e-3,
	k: 1e3, K: 1e3, M: 1e6, G: 1e9, T: 1e12,
};

const UNIT_LETTER: Record<string, Unit> = {
	R: "ohm", r: "ohm", "Ω": "ohm",
	F: "farad", f: "farad",
	V: "volt", v: "volt",
	A: "amp", H: "henry",
};

/** When only a multiplier is present, guess the unit from its scale. */
const SCALE_UNIT_HINT: Record<string, Unit> = {
	p: "farad", n: "farad", u: "farad", "µ": "farad",
	k: "ohm", K: "ohm", M: "ohm", G: "ohm", T: "ohm",
};

/** Classify a single letter that may be a multiplier, a unit, or both. */
function classify(letter: string): Result<{ multiplier: number; unit: Unit }, string> {
	// Pure unit (R, V, F, A, H, Ω) -> ×1.
	if (letter in UNIT_LETTER && !(letter in MULTIPLIER)) {
		return ok({ multiplier: 1, unit: UNIT_LETTER[letter] });
	}
	// Multiplier prefix -> infer unit from scale where possible.
	if (letter in MULTIPLIER) {
		return ok({ multiplier: MULTIPLIER[letter], unit: SCALE_UNIT_HINT[letter] ?? "unknown" });
	}
	return err(`Unknown unit/multiplier letter: "${letter}"`);
}

/** Classify a trailing letter group such as "K", "uF", "kΩ", "mA". */
function classifySuffix(letters: string): Result<{ multiplier: number; unit: Unit }, string> {
	if (letters.length === 1) return classify(letters);
	const unitChar = letters[letters.length - 1];
	const prefix = letters.slice(0, -1);
	const unit = UNIT_LETTER[unitChar];
	if (unit === undefined) return err(`Unknown unit in "${letters}"`);
	let multiplier = 1;
	if (prefix) {
		multiplier = MULTIPLIER[prefix];
		if (multiplier === undefined) return err(`Unknown multiplier prefix "${prefix}"`);
	}
	return ok({ multiplier, unit });
}

/**
 * Parse a component value string into its numeric value, multiplier and unit.
 *
 * @param input        e.g. "4K7", "4.7K", "4V7", "4.7uF", "10kΩ", "220R", "-1.5K"
 * @param defaultUnit  used only when the unit can't be inferred (e.g. "100", "5m").
 */
export function parseValue(input: string, defaultUnit?: Unit): Result<ParsedValue, string> {
	const raw = input;
	let s = input.trim();

	let sign = 1;
	if (s.startsWith("+")) s = s.slice(1);
	else if (s.startsWith("-")) { sign = -1; s = s.slice(1); }

	// head = leading number (maybe with "."), letters = unit/multiplier, tail = RKM fraction
	const m = s.match(/^(\d*\.?\d*)([a-zA-ZµΩ]+)?(\d*)$/);
	if (!m) return err(`Cannot parse "${raw}"`);

	const head = m[1];
	const letters = m[2] ?? "";
	const tail = m[3] ?? "";

	let significand: number;
	let multiplier = 1;
	let unit: Unit = "unknown";

	if (letters && tail) {
		// RKM embedded form: the single letter is the decimal point + multiplier/unit.
		if (head.includes(".")) return err(`Ambiguous value "${raw}"`);
		if (letters.length !== 1) return err(`Cannot parse "${raw}"`);
		significand = parseFloat(`${head || "0"}.${tail}`);
		let r = classify(letters);
		if (r.isErr) return err(r.error);

		({ multiplier, unit } = r.value);
	} else if (letters) {
		// Suffix form: number followed by multiplier/unit letters.
		if (head === "" || head === ".") return err(`Cannot parse "${raw}"`);
		significand = parseFloat(head);
		let r = classifySuffix(letters);
		if (r.isErr) return err(r.error);

		({ multiplier, unit } = r.value);
	} else {
		// Plain number, no unit.
		if (head === "" || head === ".") return err(`Cannot parse "${raw}"`);
		significand = parseFloat(head);
	}

	if (defaultUnit && unit === "unknown") unit = defaultUnit;

	return ok({
		value: sign * significand * multiplier,
		significand: sign * significand,
		multiplier,
		unit,
		raw,
	});
}
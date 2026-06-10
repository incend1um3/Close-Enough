interface SiPrefix {
	symbol: string;
	multiplier: number;
}

const SI_PREFIXES: SiPrefix[] = [
	{ symbol: "p", multiplier: 1e-12 },
	{ symbol: "n", multiplier: 1e-9 },
	{ symbol: "u", multiplier: 1e-6 },
	{ symbol: "m", multiplier: 1e-3 },
	{ symbol: "", multiplier: 1 }, // base unit — symbol injected at call site
	{ symbol: "K", multiplier: 1e3 },
	{ symbol: "M", multiplier: 1e6 },
	{ symbol: "G", multiplier: 1e9 },
	{ symbol: "T", multiplier: 1e12 },
];


export function formatSiValue(value: number, removeSpace = true, symbol = "Ω"): string {
	if (!isFinite(value) || value < 0) {
		throw new RangeError(`Value must be a finite non-negative number (got ${value})`);
	}
	if (value === 0) return `0 ${symbol}`;

	const prefixes = SI_PREFIXES.map((p) => ({
		...p,
		symbol: p.symbol + symbol,
	}));

	const prefix =
		[...prefixes].reverse().find((p) => value >= p.multiplier) ?? prefixes[0];

	const scaled = value / prefix.multiplier;
	const rounded = parseFloat(scaled.toPrecision(4));
	const str = rounded.toString();

	const res = str + " " + prefix.symbol;
	if (removeSpace) {
		return res.replace(' ', '');
	} else {
		return res;
	}
}
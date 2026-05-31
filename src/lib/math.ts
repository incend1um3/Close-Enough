export namespace MathUtil {
	export function percentageDifference(baseValue: number, comparedValue: number): number {
		return Math.abs((baseValue - comparedValue) / baseValue) * 100;
	}

	// n(n+1)/k
	// export function nPermuteK(n: number, k: number) {
	// 	return n*(n+1)/k
	// }

	// inverse of n(n+1)/2
	export function inverseTriangularNumber(n: number) {
		return Math.round((-1 + Math.sqrt(1 + 8 * n)) / 2);
	} 
}

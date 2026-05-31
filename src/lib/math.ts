export namespace MathUtil {
	export function percentageDifference(baseValue: number, comparedValue: number): number {
		return Math.abs((baseValue - comparedValue) / baseValue) * 100;
	}
}

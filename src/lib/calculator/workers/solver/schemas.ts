import { z } from "zod";
import { parserFor } from "true-myth/standard-schema";


const E24SubsetSchema = z.union([z.literal(6), z.literal(12), z.literal(24)]);
const E96SubsetSchema = z.union([z.literal(48), z.literal(96)]);

export const ComputeRequestSchema = z.object({
	target: z.number(),
	n: z.union([z.literal(1), z.literal(2), z.literal(3)]),
	e24Subset: E24SubsetSchema.nullable(),
	e96Subset: E96SubsetSchema.nullable(),
	useE192: z.boolean(),
});

export const parseComputeRequest = parserFor(ComputeRequestSchema);

export const VoltageDividerComputeRequestSchema = z.object({
	vin: z.number(),
	vout: z.number(),
	constraint: z.discriminatedUnion("type", [
		z.object({ type: z.literal("current"), min: z.number(), max: z.number() }),
		z.object({ type: z.literal("impedance"), min: z.number(), max: z.number() }),
	]),
	maxOutputImpedance: z.number(),
	n: z.number(),
	e24Subset: E24SubsetSchema.nullable(),
	e96Subset: E96SubsetSchema.nullable(),
	useE192: z.boolean(),
});

export const parseVoltageDividerComputeRequest = parserFor(VoltageDividerComputeRequestSchema);

export type ComputeRequest = z.infer<typeof ComputeRequestSchema>;
export type VoltageDividerComputeRequest = z.infer<typeof VoltageDividerComputeRequestSchema>;
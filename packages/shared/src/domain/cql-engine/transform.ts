import z from "zod";

export const executionModeSchema = z.enum(["cli", "engine"]);
export type ExecutionMode = z.infer<typeof executionModeSchema>;

export const cqlParametersSchema = z.record(z.string(), z.unknown());
export type CqlParameters = z.infer<typeof cqlParametersSchema>;

export const cqlTransformSchema = z.object({
  cxId: z.string(),
  patientId: z.string(),
  jobId: z.string().optional(),
  patientBundleS3Key: z.string().optional(),
  measuresToExecute: z.array(z.string()).optional(),
  mode: executionModeSchema.optional(),
  parameters: cqlParametersSchema.optional(),
});

export type CqlTransformRequest = z.infer<typeof cqlTransformSchema>;

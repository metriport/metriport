import { PatientJob } from "../../../domain/job/patient-job";
import { z } from "zod";
import { defaultRemainingAttempts } from "./utils";

export const remainingAttemptsSchema = z.number().min(1).max(defaultRemainingAttempts);

export const newDischargeRequeryParamsSchema = z.object({
  patientId: z.string(),
  cxId: z.string(),
  remainingAttempts: remainingAttemptsSchema.optional(),
});

export type NewDischargeRequeryParams = z.infer<typeof newDischargeRequeryParamsSchema>;

export const dischargeRequeryParamsOpsSchema = z.object({
  remainingAttempts: remainingAttemptsSchema,
});

export type DischargeRequeryParamsOps = z.infer<typeof dischargeRequeryParamsOpsSchema>;

export const runtimeDataSchema = z.object({
  documentQueryRequestId: z.string().optional(),
  downloadCount: z.number().optional(),
  convertCount: z.number().optional(),
});

export type DischargeRequeryJobRuntimeData = z.infer<typeof runtimeDataSchema>;

export type DischargeRequeryJob = PatientJob & {
  paramsOps: DischargeRequeryParamsOps;
  scheduledAt: Date;
  runtimeData: DischargeRequeryJobRuntimeData;
};

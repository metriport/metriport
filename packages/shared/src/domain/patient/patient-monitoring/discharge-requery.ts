import { z } from "zod";
import { PatientJob } from "../../../domain/job/patient-job";
import { defaultRemainingAttempts } from "./utils";

export const remainingAttemptsSchema = z.number().max(defaultRemainingAttempts);
export const dischargeDataSchema = z.object({
  encounterEndDate: z.string(),
  type: z.enum(["findDischargeSummary"]),
});
export type DischargeData = z.infer<typeof dischargeDataSchema>;
export const multipleDischargeDataSchema = z.array(dischargeDataSchema);

export const createDischargeRequeryParamsSchema = z.object({
  patientId: z.string(),
  cxId: z.string(),
  remainingAttempts: remainingAttemptsSchema.optional(),
  dischargeData: multipleDischargeDataSchema,
});

export type CreateDischargeRequeryParams = z.infer<typeof createDischargeRequeryParamsSchema>;

export const dischargeRequeryParamsOpsSchema = z.object({
  remainingAttempts: remainingAttemptsSchema,
  dischargeData: multipleDischargeDataSchema,
});

export type DischargeRequeryParamsOps = z.infer<typeof dischargeRequeryParamsOpsSchema>;

export const dischargeRequeryRuntimeDataSchema = z
  .object({
    documentQueryRequestId: z.string().optional(),
    downloadCount: z.number().optional(),
    convertCount: z.number().optional(),
  })
  .optional();

export type DischargeRequeryJobRuntimeData = z.infer<typeof dischargeRequeryRuntimeDataSchema>;

export const scheduledAtSchema = z.date();

export type DischargeRequeryJob = PatientJob & {
  paramsOps: DischargeRequeryParamsOps;
  scheduledAt: Date;
  runtimeData?: DischargeRequeryJobRuntimeData;
};

export function parseDischargeRequeryJob(job: PatientJob): DischargeRequeryJob {
  return {
    ...job,
    paramsOps: dischargeRequeryParamsOpsSchema.parse(job.paramsOps),
    runtimeData: dischargeRequeryRuntimeDataSchema.parse(job.runtimeData),
    scheduledAt: scheduledAtSchema.parse(job.scheduledAt),
  };
}

import z from "zod";
export const dischargeRequeryContext = "DischargeRequery";

export const processDischargeRequeryRequestSchema = z.object({
  cxId: z.string(),
  jobId: z.string(),
  patientId: z.string(),
});

export type ProcessDischargeRequeryRequest = z.infer<typeof processDischargeRequeryRequestSchema>;

export interface DischargeRequery {
  processDischargeRequery(request: ProcessDischargeRequeryRequest): Promise<void>;
}

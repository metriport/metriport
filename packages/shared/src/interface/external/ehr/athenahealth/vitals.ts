import { z } from "zod";

const vitalIdSchema = z.object({ vitalid: z.coerce.string(), clinicalelementid: z.string() });

export const createdVitalsSchema = z.object({
  success: z.boolean(),
  errormessage: z.string().optional(),
  vitalids: vitalIdSchema.array().optional(),
});

export type CreatedVitals = z.infer<typeof createdVitalsSchema>;
export const createdVitalsSuccessSchema = z.object({
  success: z.literal(true),
  vitalids: vitalIdSchema.array().min(1),
});
export type CreatedVitalsSuccess = z.infer<typeof createdVitalsSuccessSchema>;

export type VitalsCreateParams = {
  departmentid: string;
  returnvitalids: boolean;
  source: string;
  vitals: { [key: string]: string | undefined }[][];
  THIRDPARTYUSERNAME: string | undefined;
  PATIENTFACINGCALL: string | undefined;
};

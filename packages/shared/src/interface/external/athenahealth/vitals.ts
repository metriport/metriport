import { z } from "zod";

const vitalIdSchema = z.object({ vitalid: z.coerce.string(), clinicalelementid: z.string() });

export const createdVitalsSchema = z.object({
  success: z.boolean(),
  errormessage: z.string().optional(),
  vitalids: vitalIdSchema.array().optional(),
});

//{"vitalids":[{"clinicalelementid":"VITALS.BLOODPRESSURE.DIASTOLIC","vitalid":46467},{"clinicalelementid":"VITALS.BLOODPRESSURE.SYSTOLIC","vitalid":46468}],"success":true}
export type CreatedVitals = z.infer<typeof createdVitalsSchema>;
export const createdVitalsSuccessSchema = createdVitalsSchema.extend({
  success: z.literal(true),
  vitalids: vitalIdSchema.array(),
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

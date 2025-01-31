import { z } from "zod";

export const createdVitalsSchema = z.object({
  success: z.boolean(),
  errormessage: z.string().optional(),
  vitalsid: z.string().array().optional(),
});
export type CreatedVitals = z.infer<typeof createdVitalsSchema>;
export const createdVitalsSuccessSchema = createdVitalsSchema.extend({
  success: z.literal(true),
  vitalsid: z.string().array(),
});
export type CreatedVitalsSuccess = z.infer<typeof createdVitalsSuccessSchema>;

export type VitalsCreateParams = {
  departmentid: string;
  returnvitalsid: boolean;
  source: string;
  vitals: { [key: string]: string | undefined }[][];
  THIRDPARTYUSERNAME: string | undefined;
  PATIENTFACINGCALL: string | undefined;
};

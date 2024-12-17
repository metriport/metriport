import { z } from "zod";

export const vitalsCreateResponseSchema = z.object({
  success: z.boolean(),
  errormessage: z.string().optional(),
  vitalsid: z.string().array().optional(),
});
export type VitalsCreateResponse = z.infer<typeof vitalsCreateResponseSchema>;

export type VitalsCreateParams = {
  departmentid: string;
  returnvitalsid: boolean;
  source: string;
  vitals: { [key: string]: string | undefined }[][];
  THIRDPARTYUSERNAME: string | undefined;
  PATIENTFACINGCALL: string | undefined;
};

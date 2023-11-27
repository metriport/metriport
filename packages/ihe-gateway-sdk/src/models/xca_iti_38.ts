import { z } from "zod";

export const xcaIti38RequestSchema = z.array(
  z.object({
    id: z.string(),
    cxId: z.string(),
    homeCommunityId: z.string(),
    urlDQ: z.string(),
    patientIdentifier: z.object({ orgOid: z.string(), id: z.string() }),
    classCode: z
      .object({
        system: z.string(),
        code: z.string(),
        display: z.string(),
      })
      .optional(),
    practiceSettingCode: z
      .object({
        system: z.string(),
        code: z.string(),
        display: z.string(),
      })
      .optional(),
    facilityTypeCode: z
      .object({
        system: z.string(),
        code: z.string(),
        display: z.string(),
      })
      .optional(),
    documentCreationDate: z
      .object({
        dateFrom: z.string(),
        dateTo: z.string(),
      })
      .optional(),
    serviceDate: z.object({ dateFrom: z.string(), dateTo: z.string() }).optional(),
  })
);

export type XCA_ITI_38Request = z.infer<typeof xcaIti38RequestSchema>;

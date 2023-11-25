import { z } from "zod";

export const xcadqPayloadSchema = z.array(
  z.object({
    orgOid: z.string(),
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

export type XCADQRequest = z.infer<typeof xcadqPayloadSchema>;

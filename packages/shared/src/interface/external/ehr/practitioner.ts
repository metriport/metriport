import { z } from "zod";

export const practitionerSchema = z.object({
  id: z.string(),
  extension: z
    .object({
      url: z.string(),
      valueReference: z
        .object({
          reference: z.string(),
          type: z.string(),
        })
        .optional(),
    })
    .array()
    .optional(),
});
export type Practitioner = z.infer<typeof practitionerSchema>;

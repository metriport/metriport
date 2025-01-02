import { z } from "zod";
import {
  codingSchema,
  extensionSchema,
  identifierSchema,
  objectStringValueOptional,
  objectValue,
  objectValueOptional,
} from "./shared";

export const addressSchema = z.object({
  use: objectValueOptional,
  type: objectValueOptional,
  line: z.array(objectValueOptional).or(objectValueOptional).optional(),
  city: objectValueOptional,
  state: objectValueOptional,
  postalCode: objectStringValueOptional,
  country: objectValueOptional.nullish(),
  extension: extensionSchema.optional(),
  managingOrg: z
    .object({
      reference: objectValue,
    })
    .optional(),
  contained: z
    .array(
      z.object({
        Endpoint: z
          .object({
            identifier: z.array(identifierSchema).optional(),
            connectionType: z.object({
              system: objectValueOptional,
              code: objectValueOptional,
            }),
            name: objectValueOptional,
            address: objectValueOptional,
            payloadMimeType: objectValueOptional,
            payloadType: codingSchema.optional(),
            extension: z.object({
              url: objectValue,
              extension: z.array(extensionSchema),
            }),
          })
          .optional(),
      })
    )
    .optional(),
});

export type Address = z.infer<typeof addressSchema>;

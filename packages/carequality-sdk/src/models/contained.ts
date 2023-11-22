import { z } from "zod";
import { objectValue, objectValueOptional } from "./shared";

export const endpointExtensionSchema = z.array(
  z.object({
    url: z.string(),
    valueCodeableConcept: z
      .object({
        coding: z
          .object({
            system: objectValue,
            value: objectValueOptional,
          })
          .optional(),
        system: objectValueOptional,
      })
      .optional(),
    valueString: objectValue.optional(),
  })
);

export const endpointSchema = z.object({
  name: objectValue,
  address: objectValueOptional,
  connectionType: z.object({
    system: objectValue,
    code: objectValue,
  }),
  extension: z.object({
    url: z.string(),
    extension: endpointExtensionSchema,
  }),
});

export type Endpoint = z.infer<typeof endpointSchema>;

export const containedSchema = z
  .array(
    z
      .object({
        Endpoint: endpointSchema,
      })
      .optional()
  )
  .optional();

export type Contained = z.infer<typeof containedSchema>;

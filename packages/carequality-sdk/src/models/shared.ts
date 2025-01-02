import { z } from "zod";

export const objectValue = z.object({
  value: z.string(),
});

export const objectValueOptional = z
  .object({
    value: z.string().nullish(),
  })
  .nullish();

export const objectStringValueOptional = z
  .object({
    value: z.preprocess(input => {
      if (typeof input === "number") {
        return input.toString();
      }
      return input;
    }, z.string()),
  })
  .nullish();

export const objectNumericValue = z.object({
  value: z.preprocess(input => {
    if (typeof input === "string") {
      return parseInt(input);
    }
    return input;
  }, z.number()),
});

export const identifierSchema = z.object({
  use: objectValueOptional,
  type: objectValueOptional,
  system: objectValueOptional,
  value: objectValueOptional,
});

export const meta = z.object({
  lastUpdated: objectValue,
  versionId: objectValueOptional,
});

export const codingSchema = z
  .object({
    system: objectValueOptional,
    code: objectValueOptional,
  })
  .nullish();

export const type = z
  .object({
    coding: codingSchema,
  })
  .nullish();

export const nameWithUse = z.object({
  use: objectValueOptional,
  text: objectValueOptional,
});

export const positionSchema = z.object({
  latitude: z.object({
    value: z.string().transform(value => parseFloat(value).toString()),
  }),
  longitude: z.object({
    value: z.string().transform(value => parseFloat(value).toString()),
  }),
});

export const extensionSchema = z.object({
  url: z.string(),
  valueCodeableConcept: z
    .object({
      coding: z
        .object({
          system: objectValueOptional,
          value: z
            .object({
              position: positionSchema.optional(),
            })
            .optional(),
        })
        .optional(),
      system: objectValueOptional,
    })
    .optional(),
  valueString: objectValueOptional,
});

import { z } from "zod";

export const stringOrNumberSchema = z.union([z.string(), z.number()]);

/**
 * @deprecated Use numericValueSchema from shared/src/common/zod instead
 */
export const numericValue = z.preprocess(input => {
  if (typeof input === "string") {
    return parseInt(input);
  }
  return input;
}, z.number());

export function schemaOrEmpty<T extends z.ZodTypeAny>(schema: T) {
  return z.union([schema, z.literal("")]);
}
export function schemaOrArray<T extends z.ZodTypeAny>(schema: T) {
  return z.union([schema, z.array(schema)]);
}
export function schemaOrArrayOrEmpty<T extends z.ZodTypeAny>(schema: T) {
  return z.union([schema, z.array(schema), z.literal("")]);
}

export function schemaOrString<T extends z.ZodTypeAny>(schema: T) {
  return z.union([schema, z.string()]);
}

export const textSchema = z.union([
  stringOrNumberSchema,
  z.object({
    _text: stringOrNumberSchema,
  }),
]);

export type TextOrTextObject = z.infer<typeof textSchema>;

export const addressSchema = z.object({
  streetAddressLine: schemaOrArray(stringOrNumberSchema).optional(),
  city: stringOrNumberSchema.optional(),
  state: stringOrNumberSchema.optional(),
  postalCode: stringOrNumberSchema.optional(),
  country: stringOrNumberSchema.optional(),
  county: stringOrNumberSchema.optional(),
});
export type IheAddress = z.infer<typeof addressSchema>;

export const nameSchema = z.object({
  given: schemaOrArray(textSchema),
  family: textSchema,
});
export type IheName = z.infer<typeof nameSchema>;

export const telecomSchema = z.object({
  _use: z.string().optional(),
  _value: z.string().optional(),
});
export type IheTelecom = z.infer<typeof telecomSchema>;

export const identifierSchema = z.object({
  _root: z.string().optional(),
  _extension: z.string().optional(),
});
export type IheIdentifier = z.infer<typeof identifierSchema>;

export const genderCodeSchema = z.union([
  z.literal("F"),
  z.literal("M"),
  z.literal("UN"),
  z.literal("UNK"),
  z.literal("OTH"),
  z.literal("U"),
  z.literal("FTM"),
  z.literal("MTF"),
]);
export type IheGender = z.infer<typeof genderCodeSchema>;

export const slot = z.object({
  ValueList: schemaOrEmpty(
    z.object({
      Value: schemaOrArray(stringOrNumberSchema),
    })
  ),
  _name: z.string(),
});
export type Slot = z.infer<typeof slot>;

const codeSchema = z.object({
  _code: z.string(),
  _displayName: z.string(),
});
export type Code = z.infer<typeof codeSchema>;

export const AttributeSchema = z.union([
  z.object({
    Role: codeSchema,
  }),
  z.object({
    PurposeOfUse: codeSchema,
  }),
  z.object({
    PurposeForUse: codeSchema,
  }),
  textSchema,
]);
export type AttributeValue = z.infer<typeof AttributeSchema>;

export const samlHeaderSchema = z.object({
  MessageID: textSchema,
  Security: z.object({
    Timestamp: z.object({
      Created: z.string(),
      Expires: z.string(),
    }),
    Signature: z.object({
      SignatureValue: z.string(),
    }),
    Assertion: z.object({
      AttributeStatement: schemaOrArray(
        z.object({
          Attribute: z.array(
            z.union([
              z.object({
                _Name: z.string(),
                _NameFormat: z.string().optional(),
                AttributeValue: textSchema,
              }),
              z.object({
                _Name: z.string(),
                _NameFormat: z.string().optional(),
                AttributeValue: z.object({
                  Role: codeSchema,
                }),
              }),
              z.object({
                _Name: z.string(),
                _NameFormat: z.string().optional(),
                AttributeValue: z.object({
                  PurposeOfUse: codeSchema,
                }),
              }),
              z.object({
                _Name: z.string(),
                _NameFormat: z.string().optional(),
                AttributeValue: z.object({
                  PurposeForUse: codeSchema,
                }),
              }),
            ])
          ),
        })
      ),
    }),
  }),
});

export type SamlHeader = z.infer<typeof samlHeaderSchema>;

export const treatmentPurposeOfUse = "TREATMENT";

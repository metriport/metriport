import { z } from "zod";

export const schemaOrEmpty = <T extends z.ZodTypeAny>(schema: T) =>
  z.union([schema, z.literal("")]);
export const schemaOrArray = <T extends z.ZodTypeAny>(schema: T) =>
  z.union([schema, z.array(schema)]);
export const schemaOrArrayOrEmpty = <T extends z.ZodTypeAny>(schema: T) =>
  z.union([schema, z.array(schema), z.literal("")]);
export const textSchema = z.union([
  z.string(),
  z.object({
    _text: z.string(),
  }),
]);
export type TextOrTextObject = z.infer<typeof textSchema>;

export const stringOrNumberSchema = z.union([z.string(), z.number()]);

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
]);
export type IheGender = z.infer<typeof genderCodeSchema>;

export const slot = z.object({
  ValueList: z.object({
    Value: schemaOrArray(stringOrNumberSchema),
  }),
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
      AttributeStatement: z.object({
        Attribute: z.tuple([
          z.object({
            _Name: z.literal("urn:oasis:names:tc:xspa:1.0:subject:subject-id"),
            _NameFormat: z.string().optional(),
            AttributeValue: textSchema,
          }),
          z.object({
            _Name: z.literal("urn:oasis:names:tc:xspa:1.0:subject:organization"),
            _NameFormat: z.string().optional(),
            AttributeValue: textSchema,
          }),
          z.object({
            _Name: z.literal("urn:oasis:names:tc:xspa:1.0:subject:organization-id"),
            _NameFormat: z.string().optional(),
            AttributeValue: textSchema,
          }),
          z.object({
            _Name: z.literal("urn:nhin:names:saml:homeCommunityId"),
            _NameFormat: z.string().optional(),
            AttributeValue: textSchema,
          }),
          z.object({
            _Name: z.literal("urn:oasis:names:tc:xacml:2.0:subject:role"),
            _NameFormat: z.string().optional(),
            AttributeValue: z.object({
              Role: codeSchema,
            }),
          }),
          z.object({
            _Name: z.literal("urn:oasis:names:tc:xspa:1.0:subject:purposeofuse"),
            _NameFormat: z.string().optional(),
            AttributeValue: z.object({
              PurposeOfUse: codeSchema,
            }),
          }),
        ]),
      }),
    }),
  }),
});

export type SamlHeader = z.infer<typeof samlHeaderSchema>;

export const treatmentPurposeOfUse = "TREATMENT";

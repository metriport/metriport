import { z } from "zod";
import { NHIN_PURPOSE_CODE_SYSTEM } from "../shared";

export const schemaOrEmpty = <T extends z.ZodTypeAny>(schema: T) =>
  z.union([schema, z.literal("")]);
export const schemaOrArray = <T extends z.ZodTypeAny>(schema: T) =>
  z.union([schema, z.array(schema)]);
export const schemaOrArrayOrEmpty = <T extends z.ZodTypeAny>(schema: T) =>
  z.union([schema, z.array(schema), z.literal("")]);
export const TextSchema = z.union([
  z.string(),
  z.object({
    _text: z.string(),
  }),
]);
export type TextOrTextObject = z.infer<typeof TextSchema>;

export const StringOrNumberSchema = z.union([z.string(), z.number()]);

export const AddressSchema = z.object({
  streetAddressLine: schemaOrArray(StringOrNumberSchema).optional(),
  city: StringOrNumberSchema.optional(),
  state: StringOrNumberSchema.optional(),
  postalCode: StringOrNumberSchema.optional(),
  country: StringOrNumberSchema.optional(),
  county: StringOrNumberSchema.optional(),
});
export type IheAddress = z.infer<typeof AddressSchema>;

export const NameSchema = z.object({
  given: schemaOrArray(TextSchema),
  family: TextSchema,
});
export type IheName = z.infer<typeof NameSchema>;

export const TelecomSchema = z.object({
  _use: z.string().optional(),
  _value: z.string().optional(),
});
export type IheTelecom = z.infer<typeof TelecomSchema>;

export const IdentifierSchema = z.object({
  _root: z.string().optional(),
  _extension: z.string().optional(),
});
export type IheIdentifier = z.infer<typeof IdentifierSchema>;

export const genderSchema = z.object({
  _code: z.union([z.literal("F"), z.literal("M")]),
});

export const samlHeaderSchema = z.object({
  Security: z.object({
    Assertion: z.object({
      AttributeStatement: z.object({
        Attribute: z.tuple([
          z.object({
            _Name: z.literal("urn:oasis:names:tc:xspa:1.0:subject:subject-id"),
            _NameFormat: z.string(),
            AttributeValue: z.string(),
          }),
          z.object({
            _Name: z.literal("urn:oasis:names:tc:xspa:1.0:subject:organization"),
            _NameFormat: z.string(),
            AttributeValue: z.string(),
          }),
          z.object({
            _Name: z.literal("urn:oasis:names:tc:xspa:1.0:subject:organization-id"),
            _NameFormat: z.string(),
            AttributeValue: z.string(),
          }),
          z.object({
            _Name: z.literal("urn:nhin:names:saml:homeCommunityId"),
            _NameFormat: z.string(),
            AttributeValue: z.string(),
          }),
          z.object({
            _Name: z.literal("urn:oasis:names:tc:xacml:2.0:subject:role"),
            _NameFormat: z.string(),
            AttributeValue: z.object({
              Role: z.object({
                _xmlns: z.string().optional(),
                _code: z.string(),
                _codeSystem: z.string().optional(),
                _codeSystemName: z.string().optional(),
                _displayName: z.string(),
              }),
            }),
          }),
          z.object({
            _Name: z.literal("urn:oasis:names:tc:xspa:1.0:subject:purposeofuse"),
            _NameFormat: z.string(),
            AttributeValue: z.object({
              PurposeOfUse: z.object({
                _xmlns: z.string().optional(),
                _xsi: z.string().optional(),
                _type: z.string().optional(),
                _code: z.literal("TREATMENT"),
                _codeSystem: z.literal(NHIN_PURPOSE_CODE_SYSTEM),
                _codeSystemName: z.literal("nhin-purpose"),
                _displayName: z.literal("Treatment"),
              }),
            }),
          }),
        ]),
      }),
    }),
  }),
});

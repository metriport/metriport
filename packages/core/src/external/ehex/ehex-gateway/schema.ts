import { z } from "zod";

export const treatmentPurposeOfUse = "TREATMENT";
export const stringOrNumberSchema = z.union([z.string(), z.number()]);
export const documentEntryTypeSlotName = "$XDSDocumentEntryType";

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

export const addressTextSchema = z.union([
  stringOrNumberSchema,
  z.object({
    _text: stringOrNumberSchema,
    _partType: z.string().optional(),
  }),
]);

export const addressSchema = z.object({
  streetAddressLine: schemaOrArray(addressTextSchema).optional(),
  city: addressTextSchema.optional(),
  state: addressTextSchema.optional(),
  postalCode: addressTextSchema.optional(),
  country: addressTextSchema.optional(),
  county: addressTextSchema.optional(),
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
  _codeSystem: z.string().optional(),
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

const signedInfoSchema = z.object({
  CanonicalizationMethod: z.object({
    _Algorithm: z.string(),
  }),
  SignatureMethod: z.object({
    _Algorithm: z.string(),
  }),
  Reference: schemaOrArray(
    z.object({
      _URI: z.string().optional(),
      DigestMethod: z
        .object({
          _Algorithm: z.string().optional(),
        })
        .optional(),
      DigestValue: z.string(),
    })
  ),
});
export type SignedInfo = z.infer<typeof signedInfoSchema>;

const assertionSignatureKeyInfoSchema = z.object({
  X509Data: z.object({
    X509Certificate: z.string(),
  }),
  KeyValue: z
    .object({
      RSAKeyValue: z.object({
        Modulus: z.string(),
        Exponent: z.string(),
      }),
    })
    .optional(),
});

const signatureKeyInfoSchema = z.object({
  SecurityTokenReference: z.object({
    KeyIdentifier: z.object({
      _ValueType: z.string(),
      _text: z.string(),
    }),
  }),
});
export type SignatureKeyInfoSchema = z.infer<typeof signatureKeyInfoSchema>;

const signatureBaseSchema = z.object({
  SignedInfo: signedInfoSchema,
  SignatureValue: z.string(),
  KeyInfo: signatureKeyInfoSchema.optional(),
});

const assertionSignatureSchema = signatureBaseSchema.extend({
  KeyInfo: assertionSignatureKeyInfoSchema,
});

export const samlHeaderBaseSchema = z.object({
  MessageID: textSchema,
  Action: textSchema,
  To: textSchema,
  ReplyTo: z
    .object({
      Address: textSchema,
    })
    .optional(),
  From: z
    .object({
      Address: textSchema,
    })
    .nullish(),
});
export type SamlHeaderBase = z.infer<typeof samlHeaderBaseSchema>;

export const soapWithHeaderBaseSchema = z.object({
  Envelope: z.object({
    Header: samlHeaderBaseSchema,
  }),
});

export const samlHeaderSchema = z.object({
  ...samlHeaderBaseSchema.shape,
  Security: z.object({
    Timestamp: z.object({
      Created: z.string(),
      Expires: z.string(),
    }),
    Assertion: z.object({
      _ID: z.string(),
      AttributeStatement: schemaOrArray(
        z.object({
          Attribute: schemaOrArray(
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
      Signature: assertionSignatureSchema,
      Subject: z.object({
        NameID: z.object({
          _Format: z.string().optional(),
          _text: z.string(),
        }),
        SubjectConfirmation: schemaOrArray(
          z.object({
            _Method: z.string(),
            NameID: z
              .object({
                _Format: z.string(),
                _text: z.string(),
              })
              .optional(),
            SubjectConfirmationData: z.object({
              KeyInfo: z.object({
                KeyValue: z.object({
                  RSAKeyValue: z.object({
                    Modulus: z.string(),
                    Exponent: z.string(),
                  }),
                }),
              }),
            }),
          })
        ),
      }),
    }),
    Signature: signatureBaseSchema,
  }),
});
export type SamlHeader = z.infer<typeof samlHeaderSchema>;

export type ItiRequestWithSamlHeader = {
  Envelope: {
    Header: SamlHeader;
  };
};

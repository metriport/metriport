import { z } from "zod";
import {
  schemaOrArray,
  schemaOrArrayOrEmpty,
  TextSchema,
  StringOrNumberSchema,
} from "../../schema";

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

export const PatientRegistryProfileSchema = z.object({
  acknowledgement: z.object({
    typeCode: z.object({
      _code: z.string(),
    }),
    acknowledgementDetail: z
      .object({
        code: z.object({
          _code: z.string().optional(),
          _codeSystem: z.string().optional(),
        }),
        text: TextSchema.optional(),
        location: z.string().optional(),
      })
      .optional(),
  }),
  controlActProcess: z.object({
    subject: z.object({
      registrationEvent: z.object({
        subject1: z.object({
          patient: z.object({
            id: z.object({
              _root: z.string(),
              _extension: z.string(),
            }),
            patientPerson: z.object({
              addr: schemaOrArrayOrEmpty(AddressSchema).optional(),
              name: schemaOrArray(NameSchema),
              telecom: schemaOrArrayOrEmpty(TelecomSchema).optional(),
              asOtherIDs: z.object({
                id: schemaOrArrayOrEmpty(IdentifierSchema).optional(),
              }),
              administrativeGenderCode: z
                .object({
                  _code: z.union([z.literal("F"), z.literal("M")]),
                })
                .optional(),
              birthTime: z.object({
                _value: z.string(),
              }),
            }),
          }),
        }),
      }),
    }),
    queryAck: z.object({
      queryResponseCode: z.object({
        _code: z.string(),
      }),
    }),
  }),
});
export type PatientRegistryProfile = z.infer<typeof PatientRegistryProfileSchema>;

export const iti55Body = z.object({
  PRPA_IN201306UV02: PatientRegistryProfileSchema,
});

export const iti55Schema = z.object({
  Envelope: z.object({
    Header: z.any(),
    Body: iti55Body,
  }),
});
export type Iti55Response = z.infer<typeof iti55Schema>;

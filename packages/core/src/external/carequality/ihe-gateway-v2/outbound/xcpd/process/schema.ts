import { z } from "zod";
import {
  schemaOrArray,
  schemaOrArrayOrEmpty,
  textSchema,
  stringOrNumberSchema,
} from "../../schema";

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

const genderCodeSchema = z.union([z.literal("F"), z.literal("M"), z.literal("UN")]);
export type IheGender = z.infer<typeof genderCodeSchema>;

export const patientRegistryProfileSchema = z.object({
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
        text: textSchema.optional(),
        location: z.string().optional(),
      })
      .optional(),
  }),
  controlActProcess: z.object({
    subject: z
      .object({
        registrationEvent: z.object({
          subject1: z.object({
            patient: z.object({
              id: z.object({
                _root: z.string(),
                _extension: z.string(),
              }),
              patientPerson: z.object({
                addr: schemaOrArrayOrEmpty(addressSchema).optional(),
                name: schemaOrArray(nameSchema),
                telecom: schemaOrArrayOrEmpty(telecomSchema).optional(),
                asOtherIDs: schemaOrArrayOrEmpty(
                  z.object({
                    id: schemaOrArrayOrEmpty(identifierSchema).optional(),
                  })
                ).optional(),
                administrativeGenderCode: z.object({
                  _code: genderCodeSchema,
                }),
                birthTime: z.object({
                  _value: z.string(),
                }),
              }),
            }),
          }),
        }),
      })
      .optional(),
    queryAck: z.object({
      queryResponseCode: z.object({
        _code: z.string(),
      }),
    }),
  }),
});
export type PatientRegistryProfile = z.infer<typeof patientRegistryProfileSchema>;

export const iti55Body = z.object({
  PRPA_IN201306UV02: patientRegistryProfileSchema,
});

export const iti55Schema = z.object({
  Envelope: z.object({
    Body: iti55Body,
  }),
});
export type Iti55Response = z.infer<typeof iti55Schema>;

import { z } from "zod";
import {
  schemaOrArray,
  schemaOrArrayOrEmpty,
  TextSchema,
  AddressSchema,
  NameSchema,
  TelecomSchema,
  IdentifierSchema,
  genderSchema,
} from "../../../schema";

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
              administrativeGenderCode: genderSchema.optional(),
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

export const iti55ResponseBody = z.object({
  PRPA_IN201306UV02: PatientRegistryProfileSchema,
});

export const iti55ResponseSchema = z.object({
  Envelope: z.object({
    Header: z.any(),
    Body: iti55ResponseBody,
  }),
});
export type Iti55Response = z.infer<typeof iti55ResponseSchema>;

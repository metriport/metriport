import { z } from "zod";
import {
  schemaOrArray,
  schemaOrArrayOrEmpty,
  genderSchema,
  addressSchema,
  nameSchema,
  telecomSchema,
  identifierSchema,
  textSchema,
} from "../../../schema";

export const patientRegistryProfileSchema = z.object({
  acknowledgement: z.object({
    typeCode: z.object({
      _code: z.string(),
    }),
    acknowledgementDetail: z
      .object({
        code: z
          .object({
            _code: z.string().optional(),
            _codeSystem: z.string().optional(),
          })
          .optional(),
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
                administrativeGenderCode: genderSchema.optional(),
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

export const iti55ResponseBody = z.object({
  PRPA_IN201306UV02: patientRegistryProfileSchema,
});

export const iti55ResponseSchema = z.object({
  Envelope: z.object({
    Body: iti55ResponseBody,
  }),
});
export type Iti55Response = z.infer<typeof iti55ResponseSchema>;

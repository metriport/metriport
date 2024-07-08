import { z } from "zod";
import {
  schemaOrArray,
  textSchema,
  addressSchema,
  samlHeaderSchema,
  genderCodeSchema,
  schemaOrArrayOrEmpty,
} from "../../../schema";

const nameSchema = z.object({
  family: textSchema,
  given: schemaOrArray(textSchema),
});

export const QueryByParameterSchema = z.object({
  parameterList: z.object({
    livingSubjectAdministrativeGender: z.object({
      value: z
        .object({
          _code: genderCodeSchema,
        })
        .optional(),
      semanticsText: z.literal("LivingSubject.administrativeGender"),
    }),
    livingSubjectBirthTime: z.object({
      value: z.object({
        _value: z.string(),
      }),
      semanticsText: z.literal("LivingSubject.birthTime"),
    }),
    livingSubjectId: z
      .object({
        value: schemaOrArrayOrEmpty(
          z.object({
            _extension: z.string(),
            _root: z.string(),
          })
        ).optional(),
        semanticsText: z.literal("LivingSubject.id"),
      })
      .optional(),
    livingSubjectName: z.object({
      value: schemaOrArray(nameSchema),
      semanticsText: z.literal("LivingSubject.name"),
    }),
    patientAddress: z
      .object({
        value: schemaOrArrayOrEmpty(addressSchema).optional(),
        semanticsText: z.literal("Patient.addr"),
      })
      .optional(),
    patientTelecom: z
      .object({
        value: schemaOrArrayOrEmpty(
          z.object({
            _value: z.string(),
          })
        ).optional(),
        semanticsText: z.literal("Patient.telecom"),
      })
      .optional(),
    principalCareProviderId: z
      .object({
        value: schemaOrArrayOrEmpty(
          z.object({
            _extension: z.string(),
            _root: z.string(),
          })
        ).optional(),
        semanticsText: z.literal("AssignedProvider.id"),
      })
      .optional(),
  }),
});

export const iti55RequestBody = z.object({
  PRPA_IN201305UV02: z.object({
    controlActProcess: z.object({
      queryByParameter: QueryByParameterSchema,
    }),
  }),
});

export const iti55RequestSchema = z.object({
  Envelope: z.object({
    Header: samlHeaderSchema,
    Body: iti55RequestBody,
  }),
});
export type Iti55Request = z.infer<typeof iti55RequestSchema>;

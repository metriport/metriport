import { z } from "zod";
import {
  schemaOrArray,
  textSchema,
  addressSchema,
  samlHeaderSchema,
  genderCodeSchema,
  schemaOrArrayOrEmpty,
} from "../../../schema";

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
    livingSubjectId: schemaOrArrayOrEmpty(
      z.object({
        value: z.object({
          _extension: z.string(),
          _root: z.string(),
        }),
        semanticsText: z.literal("LivingSubject.id"),
      })
    ).optional(),
    livingSubjectName: schemaOrArray(
      z.object({
        value: z.object({
          family: textSchema,
          given: schemaOrArray(textSchema),
        }),
        semanticsText: z.literal("LivingSubject.name"),
      })
    ),
    patientAddress: schemaOrArrayOrEmpty(
      z.object({
        value: addressSchema,
        semanticsText: z.literal("Patient.addr"),
      })
    ).optional(),
    patientTelecom: schemaOrArrayOrEmpty(
      z.object({
        value: z.object({
          _value: z.string(),
        }),
        semanticsText: z.literal("Patient.telecom"),
      })
    ).optional(),
    principalCareProviderId: schemaOrArrayOrEmpty(
      z.object({
        value: z.object({
          _extension: z.string(),
          _root: z.string(),
        }),
      })
    ).optional(),
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

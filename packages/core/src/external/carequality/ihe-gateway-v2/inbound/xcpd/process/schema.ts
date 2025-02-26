import { z } from "zod";
import {
  schemaOrArray,
  textSchema,
  addressSchema,
  samlHeaderSchema,
  genderCodeSchema,
  schemaOrArrayOrEmpty,
  schemaOrEmpty,
} from "../../../schema";

const nameSchema = z.object({
  family: textSchema,
  given: schemaOrArray(textSchema),
});

const idSchema = z.object({
  _extension: z.string(),
  _root: z.string(),
});

export const QueryByParameterSchema = z.object({
  parameterList: z.object({
    livingSubjectAdministrativeGender: z
      .object({
        value: schemaOrEmpty(
          z.object({
            _code: genderCodeSchema,
          })
        ),
      })
      .optional(),
    livingSubjectBirthTime: z.object({
      value: z.object({
        _value: z.string(),
      }),
    }),
    livingSubjectId: schemaOrArray(
      z.object({
        value: schemaOrArrayOrEmpty(idSchema).optional(),
      })
    ).optional(),
    livingSubjectName: schemaOrArray(
      z.object({
        value: nameSchema,
      })
    ),
    patientAddress: z
      .object({
        value: schemaOrArrayOrEmpty(addressSchema).optional(),
      })
      .optional(),
    patientTelecom: z
      .object({
        value: schemaOrArrayOrEmpty(
          z.object({
            _value: z.string(),
          })
        ).optional(),
      })
      .optional(),
    principalCareProviderId: z
      .object({
        value: schemaOrArrayOrEmpty(idSchema).optional(),
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

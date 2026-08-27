import { z } from "zod";
import {
  addressSchema,
  genderCodeSchema,
  identifierSchema,
  nameSchema,
  schemaOrArray,
  schemaOrArrayOrEmpty,
  telecomSchema,
  textSchema,
} from "../../../schema";

function isNilRegistrationEvent(registrationEvent: unknown): boolean {
  if (!registrationEvent || typeof registrationEvent !== "object") {
    return true;
  }
  const event = registrationEvent as Record<string, unknown>;
  return (
    event["_xsi:nil"] === "true" ||
    event["_xsi:nil"] === true ||
    event["_nil"] === "true" ||
    event["_nil"] === true
  );
}

// Sometimes, the subject.registrationEvent is nil, so we need to filter it out.
function filterNilSubject(subject: unknown): unknown {
  if (!subject || typeof subject !== "object") {
    return undefined;
  }
  const subjectObj = subject as Record<string, unknown>;
  const registrationEvent = subjectObj.registrationEvent;
  if (!registrationEvent || isNilRegistrationEvent(registrationEvent)) {
    return undefined;
  }
  return subject;
}

function filterNilSubjects(subjects: unknown): unknown {
  if (subjects === null || subjects === undefined) return undefined;

  if (Array.isArray(subjects)) {
    const filtered = subjects.map(filterNilSubject).filter(Boolean);
    return filtered.length > 0 ? filtered : undefined;
  }
  return filterNilSubject(subjects);
}

const subjectSchema = z.object({
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
          administrativeGenderCode: z
            .object({
              _code: genderCodeSchema,
            })
            .optional(),
          birthTime: z.object({
            _value: z.string(),
          }),
        }),
      }),
    }),
    custodian: z
      .object({
        assignedEntity: z.object({
          _classCode: z.string().optional(),
          id: z
            .object({
              _root: z.string().optional(),
            })
            .optional(),
          code: z
            .object({
              _code: z.string().optional(),
              _codeSystem: z.string().optional(),
            })
            .optional(),
        }),
      })
      .optional(),
  }),
});

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
    subject: z.preprocess(filterNilSubjects, schemaOrArray(subjectSchema).optional()),
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

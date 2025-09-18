import { normalizeZipCodeNewSafe } from "@metriport/shared/domain/address/zip";
import { normalizePhoneNumberSafe } from "@metriport/shared/domain/contact/phone";
import { normalizeGenderSafe } from "@metriport/shared/domain/gender";
import { normalizeSsnSafe } from "@metriport/shared/domain/patient/ssn";
import { buildDayjs, isValidISODate } from "@metriport/shared/common/date";
import { z } from "zod";

const genderSchema = z.string().transform(normalizeGenderSafe).optional();
const ssnSchema = z
  .string()
  .transform(val => normalizeSsnSafe(val))
  .optional();
const phoneSchema = z.string().transform(normalizePhoneNumberSafe).optional();
const zipSchema = z.string().transform(normalizeZipCodeNewSafe).optional();

const PatClassEnum = z
  .string()
  .optional()
  .transform(val => {
    if (!val) return undefined;
    const mapping: Record<string, string> = {
      OBSTETRICS: "B",
      "COMMERCIAL ACCOUNT": "C",
      EMERGENCY: "E",
      INPATIENT: "I",
      "NOT APPLICABLE": "N",
      OUTPATIENT: "O",
      PREADMIT: "P",
      "RECURRING PATIENT": "R",
      UNKNOWN: "U",
    };
    const mappedValue = mapping[val.toUpperCase()] ?? val;
    const validCodes = ["B", "C", "E", "I", "N", "O", "P", "R", "U"];
    const result = validCodes.includes(mappedValue) ? mappedValue : mapToU(val, "Patient Class");
    return result;
  });

function mapToU(val: string, fieldName: string): string {
  console.log(`WARNING: ${fieldName}: Invalid value "${val}" mapped to "U"`);
  return "U";
}

const MaritalStatusEnum = z
  .string()
  .optional()
  .transform(val => {
    if (!val) return undefined;
    const validCodes = [
      "A",
      "B",
      "C",
      "D",
      "E",
      "G",
      "I",
      "M",
      "N",
      "O",
      "P",
      "R",
      "S",
      "T",
      "U",
      "W",
    ];
    const upperVal = val.toUpperCase();
    const result = validCodes.includes(upperVal) ? upperVal : mapToU(val, "Martial Status");

    return result;
  });

const dateSchema = z.string().min(1, "Date is required").refine(isValidISODate, {
  message: "Date must be a valid ISO 8601 date (YYYY-MM-DD format)",
});

export const rowSchema = z.object({
  FacilityAbbrev: z.string().min(1, "Facility abbreviation is required"),
  FacilityName: z.string().min(1, "Facility name is required"),
  VisitNumber: z.string().min(1, "Visit number is required"),
  PatientID: z.string().min(1, "Patient ID is required"),
  LastName: z.string().min(1, "Last name is required"),
  FirstName: z.string().min(1, "First name is required"),
  StreetAddress: z.string().optional(),
  City: z.string().optional(),
  State: z
    .string()
    .min(2, "State must be at least 2 characters")
    .max(2, "State should be 2 characters")
    .transform(val => val.toUpperCase()),
  AttendingPhysicianName: z.string().optional(),
  SendingToSystem: z.string().min(1, "Sending to system is required"),
  MetriplexPatID: z.string().min(1, "Metriplex patient ID is required"),
  AdmitDateTime: z.string().optional(),
  MiddleName: z.string().optional(),
  PrimaryPhoneNumber: phoneSchema,
  SSN: ssnSchema,
  PatientDateofBirth: dateSchema.transform((val: string) => {
    const parsed = buildDayjs(val);
    return parsed.format("YYYYMMDD");
  }),
  Gender: genderSchema,
  MaritalStatus: MaritalStatusEnum,
  ZipCode: zipSchema,
  ChiefComplaint: z.string().optional(),
  DiagnosisCode: z.string().optional(),
  DiagnosisText: z.string().optional(),
  DiagnosisCodingSystem: z.string().optional(),
  ReferringPhysicianName: z.string().optional(),
  AdmittingPhysicianName: z.string().optional(),
  DischargeDateTime: z.string().optional(),
  EmergencySeverityLevel: z
    .string()
    .optional()
    .refine(val => !val || /^[1-5]$/.test(val), {
      message: "ESI level must be 1-5",
    }),
  PatClass: PatClassEnum,
});

export type Row = z.infer<typeof rowSchema>;

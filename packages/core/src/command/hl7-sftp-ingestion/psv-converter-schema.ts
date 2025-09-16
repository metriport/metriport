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

const PatClassEnum = z.enum(["B", "C", "E", "I", "N", "O", "P", "R", "U"]).optional();

const MaritalStatusEnum = z.enum(["S", "M", "D", "W"]).optional();

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
  StreetAddress: z.string().min(1, "Street address is required"),
  City: z.string().min(1, "City is required"),
  State: z
    .string()
    .min(2, "State must be at least 2 characters")
    .max(2, "State should be 2 characters")
    .transform(val => val.toUpperCase()),
  AttendingPhysicianName: z.string().min(1, "Attending physician name is required"),
  SendingToSystem: z.string().min(1, "Sending to system is required"),
  MetriplexPatID: z.string().min(1, "Metriplex patient ID is required"),
  AdmitDateTime: z.string().min(1, "Admit date/time is required"),
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
    .regex(/^[1-5]$/, "ESI level must be 1-5")
    .optional(),
  PatClass: PatClassEnum,
});

export type Row = z.infer<typeof rowSchema>;

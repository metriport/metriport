import { normalizeZipCodeNewSafe } from "@metriport/shared/domain/address/zip";
import { normalizePhoneNumberSafe } from "@metriport/shared/domain/contact/phone";
import { normalizeGenderSafe } from "@metriport/shared/domain/gender";
import { normalizeSsnSafe } from "@metriport/shared/domain/patient/ssn";
import { z } from "zod";

const genderSchema = z
  .string()
  .transform(val => normalizeGenderSafe(val))
  .optional();
const ssnSchema = z
  .string()
  .transform(val => {
    const normalized = normalizeSsnSafe(val);
    if (normalized) {
      return val;
    }
    return undefined;
  })
  .optional();
const phoneSchema = z
  .string()
  .transform(val => normalizePhoneNumberSafe(val))
  .optional();
const zipSchema = z
  .string()
  .transform(val => normalizeZipCodeNewSafe(val))
  .optional();

const PatClassEnum = z.enum(["B", "C", "E", "I", "N", "O", "P", "R", "U"]).optional();

const MaritalStatusEnum = z.enum(["single", "married", "divorced", "widowed"]).optional();

export const rowSchema = z
  .object({
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
      .max(2, "State should be 2 characters"),
    AttendingPhysicianName: z.string().min(1, "Attending physician name is required"),
    SendingToSystem: z.string().min(1, "Sending to system is required"),
    MetriplexPatID: z.string().min(1, "Metriplex patient ID is required"),
    AdmitDateTime: z.string().min(1, "Admit date/time is required"),
    MiddleName: z.string().optional(),
    PrimaryPhoneNumber: phoneSchema,
    SSN: ssnSchema,
    PatientDateofBirth: z.string().min(1, "Date of birth is required"),
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
  })
  .transform(data => ({
    facilityAbbrev: data.FacilityAbbrev,
    facilityName: data.FacilityName,
    visitNumber: data.VisitNumber,
    patientID: data.PatientID,
    lastName: data.LastName,
    firstName: data.FirstName,
    streetAddress: data.StreetAddress,
    city: data.City,
    state: data.State,
    attendingPhysicianName: data.AttendingPhysicianName,
    sendingToSystem: data.SendingToSystem,
    metriplexPatID: data.MetriplexPatID,
    admitDateTime: data.AdmitDateTime,
    middleName: data.MiddleName,
    primaryPhoneNumber: data.PrimaryPhoneNumber,
    ssn: data.SSN,
    patientDateofBirth: data.PatientDateofBirth,
    gender: data.Gender,
    maritalStatus: data.MaritalStatus,
    zipCode: data.ZipCode,
    chiefComplaint: data.ChiefComplaint,
    diagnosisCode: data.DiagnosisCode,
    diagnosisText: data.DiagnosisText,
    diagnosisCodingSystem: data.DiagnosisCodingSystem,
    referringPhysicianName: data.ReferringPhysicianName,
    admittingPhysicianName: data.AdmittingPhysicianName,
    dischargeDateTime: data.DischargeDateTime,
    emergencySeverityLevel: data.EmergencySeverityLevel,
    patClass: data.PatClass,
  }));

export type Row = z.infer<typeof rowSchema>;

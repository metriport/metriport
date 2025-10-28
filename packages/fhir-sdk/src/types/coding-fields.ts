import {
  AllergyIntolerance,
  CarePlan,
  Composition,
  Condition,
  Coverage,
  DiagnosticReport,
  DocumentReference,
  Encounter,
  FamilyMemberHistory,
  Immunization,
  Location,
  Medication,
  MedicationAdministration,
  MedicationDispense,
  MedicationRequest,
  MedicationStatement,
  Observation,
  Organization,
  Patient,
  Practitioner,
  Procedure,
  RelatedPerson,
  RiskAssessment,
  ServiceRequest,
} from "@medplum/fhirtypes";
import { SmartCodeableConcept, Smart } from "./smart-resources";

/**
 * Coding Field Type Mappings
 *
 * This file defines explicit type overrides for CodeableConcept and Coding fields
 * in each FHIR resource type. These interfaces document which fields get enhanced
 * with SmartCodeableConcept/SmartCoding utilities at runtime.
 *
 * Runtime behavior: All CodeableConcept and Coding fields are automatically wrapped
 * with smart utilities via proxies when accessed through the SDK.
 *
 * TypeScript limitations: Due to TypeScript's union type complexity limits, we cannot
 * automatically enforce these transformations at the type level for all CodeableConcept
 * properties. To provide type-safe access to coding utilities, we export specific type
 * aliases (SmartObservation, SmartCondition, etc.) that combine Smart<T> with field
 * overrides.
 *
 * USAGE: Always use the specific Smart type aliases (e.g., SmartObservation) instead of
 * the generic Smart<Observation> pattern in user-facing code. This ensures TypeScript
 * recognizes the coding utility methods without requiring type assertions.
 *
 * @example
 * // ✅ GOOD - Use specific type alias
 * const obs: SmartObservation = sdk.getObservationById("123")!;
 * obs.code?.hasLoinc(); // TypeScript knows this method exists
 *
 * // ❌ BAD - Generic Smart<T> requires type assertions
 * const obs: Smart<Observation> = sdk.getObservationById("123")!;
 * (obs.code as SmartCodeableConcept).hasLoinc(); // Requires manual casting
 */

/**
 * Observation-specific field overrides for CodeableConcept properties
 */
export interface ObservationCodingFields {
  code?: SmartCodeableConcept;
  category?: SmartCodeableConcept[];
  valueCodeableConcept?: SmartCodeableConcept;
  dataAbsentReason?: SmartCodeableConcept;
  interpretation?: SmartCodeableConcept[];
  bodySite?: SmartCodeableConcept;
  method?: SmartCodeableConcept;
}

/**
 * Condition-specific field overrides for CodeableConcept properties
 */
export interface ConditionCodingFields {
  clinicalStatus?: SmartCodeableConcept;
  verificationStatus?: SmartCodeableConcept;
  category?: SmartCodeableConcept[];
  severity?: SmartCodeableConcept;
  code?: SmartCodeableConcept;
  bodySite?: SmartCodeableConcept[];
}

/**
 * Procedure-specific field overrides for CodeableConcept properties
 */
export interface ProcedureCodingFields {
  statusReason?: SmartCodeableConcept;
  category?: SmartCodeableConcept;
  code?: SmartCodeableConcept;
  reasonCode?: SmartCodeableConcept[];
  bodySite?: SmartCodeableConcept[];
  outcome?: SmartCodeableConcept;
  complication?: SmartCodeableConcept[];
  followUp?: SmartCodeableConcept[];
  usedCode?: SmartCodeableConcept[];
}

/**
 * AllergyIntolerance-specific field overrides for CodeableConcept properties
 */
export interface AllergyIntoleranceCodingFields {
  clinicalStatus?: SmartCodeableConcept;
  verificationStatus?: SmartCodeableConcept;
  code?: SmartCodeableConcept;
}

/**
 * Encounter-specific field overrides for CodeableConcept properties
 */
export interface EncounterCodingFields {
  type?: SmartCodeableConcept[];
  serviceType?: SmartCodeableConcept;
  priority?: SmartCodeableConcept;
  reasonCode?: SmartCodeableConcept[];
}

/**
 * DiagnosticReport-specific field overrides for CodeableConcept properties
 */
export interface DiagnosticReportCodingFields {
  category?: SmartCodeableConcept[];
  code?: SmartCodeableConcept;
  conclusionCode?: SmartCodeableConcept[];
}

/**
 * Immunization-specific field overrides for CodeableConcept properties
 */
export interface ImmunizationCodingFields {
  statusReason?: SmartCodeableConcept;
  vaccineCode?: SmartCodeableConcept;
  reportOrigin?: SmartCodeableConcept;
  site?: SmartCodeableConcept;
  route?: SmartCodeableConcept;
  reasonCode?: SmartCodeableConcept[];
  subpotentReason?: SmartCodeableConcept[];
  programEligibility?: SmartCodeableConcept[];
  fundingSource?: SmartCodeableConcept;
}

/**
 * Medication-specific field overrides for CodeableConcept properties
 */
export interface MedicationCodingFields {
  code?: SmartCodeableConcept;
  form?: SmartCodeableConcept;
}

/**
 * MedicationRequest-specific field overrides for CodeableConcept properties
 */
export interface MedicationRequestCodingFields {
  statusReason?: SmartCodeableConcept;
  category?: SmartCodeableConcept[];
  medicationCodeableConcept?: SmartCodeableConcept;
  performerType?: SmartCodeableConcept;
  reasonCode?: SmartCodeableConcept[];
  courseOfTherapyType?: SmartCodeableConcept;
}

/**
 * MedicationAdministration-specific field overrides for CodeableConcept properties
 */
export interface MedicationAdministrationCodingFields {
  statusReason?: SmartCodeableConcept[];
  category?: SmartCodeableConcept;
  medicationCodeableConcept?: SmartCodeableConcept;
  reasonCode?: SmartCodeableConcept[];
}

/**
 * MedicationDispense-specific field overrides for CodeableConcept properties
 */
export interface MedicationDispenseCodingFields {
  statusReasonCodeableConcept?: SmartCodeableConcept;
  category?: SmartCodeableConcept;
  medicationCodeableConcept?: SmartCodeableConcept;
  type?: SmartCodeableConcept;
}

/**
 * MedicationStatement-specific field overrides for CodeableConcept properties
 */
export interface MedicationStatementCodingFields {
  statusReason?: SmartCodeableConcept[];
  category?: SmartCodeableConcept;
  medicationCodeableConcept?: SmartCodeableConcept;
  reasonCode?: SmartCodeableConcept[];
}

/**
 * FamilyMemberHistory-specific field overrides for CodeableConcept properties
 */
export interface FamilyMemberHistoryCodingFields {
  dataAbsentReason?: SmartCodeableConcept;
  relationship?: SmartCodeableConcept;
  sex?: SmartCodeableConcept;
  reasonCode?: SmartCodeableConcept[];
}

/**
 * RelatedPerson-specific field overrides for CodeableConcept properties
 */
export interface RelatedPersonCodingFields {
  relationship?: SmartCodeableConcept[];
}

/**
 * RiskAssessment-specific field overrides for CodeableConcept properties
 */
export interface RiskAssessmentCodingFields {
  method?: SmartCodeableConcept;
  code?: SmartCodeableConcept;
  reasonCode?: SmartCodeableConcept[];
}

/**
 * ServiceRequest-specific field overrides for CodeableConcept properties
 */
export interface ServiceRequestCodingFields {
  category?: SmartCodeableConcept[];
  code?: SmartCodeableConcept;
  orderDetail?: SmartCodeableConcept[];
  asNeededCodeableConcept?: SmartCodeableConcept;
  performerType?: SmartCodeableConcept;
  locationCode?: SmartCodeableConcept[];
  reasonCode?: SmartCodeableConcept[];
  bodySite?: SmartCodeableConcept[];
}

/**
 * CarePlan-specific field overrides for CodeableConcept properties
 */
export interface CarePlanCodingFields {
  category?: SmartCodeableConcept[];
}

/**
 * Patient-specific field overrides for CodeableConcept properties
 */
export interface PatientCodingFields {
  maritalStatus?: SmartCodeableConcept;
}

/**
 * Practitioner-specific field overrides for CodeableConcept properties
 */
export interface PractitionerCodingFields {
  communication?: SmartCodeableConcept[];
}

/**
 * Organization-specific field overrides for CodeableConcept properties
 */
export interface OrganizationCodingFields {
  type?: SmartCodeableConcept[];
}

/**
 * Location-specific field overrides for CodeableConcept properties
 */
export interface LocationCodingFields {
  type?: SmartCodeableConcept[];
  physicalType?: SmartCodeableConcept;
}

/**
 * Composition-specific field overrides for CodeableConcept properties
 */
export interface CompositionCodingFields {
  type?: SmartCodeableConcept;
  category?: SmartCodeableConcept[];
}

/**
 * Coverage-specific field overrides for CodeableConcept properties
 */
export interface CoverageCodingFields {
  type?: SmartCodeableConcept;
}

/**
 * DocumentReference-specific field overrides for CodeableConcept properties
 */
export interface DocumentReferenceCodingFields {
  type?: SmartCodeableConcept;
  category?: SmartCodeableConcept[];
  securityLabel?: SmartCodeableConcept[];
}

/**
 * Specific type aliases that combine Smart with coding field overrides.
 *
 * ALWAYS use these specific types in user-facing code instead of the generic Smart<T>
 * pattern to enable full TypeScript support for coding system utilities.
 *
 * These types provide:
 * - All Smart resource methods (reference resolution, reverse lookup, etc.)
 * - All CodeableConcept coding utilities (hasLoinc(), getIcd10Code(), etc.)
 * - Full TypeScript autocomplete and type checking
 *
 * @example
 * // ✅ GOOD - Full TypeScript support
 * const obs: SmartObservation = sdk.getObservationById("123")!;
 * if (obs.code?.hasLoinc("2339-0")) {
 *   const loincCode = obs.code.getLoincCode();
 *   console.log("Found glucose observation:", loincCode);
 * }
 *
 * @example
 * // ✅ GOOD - Works in function signatures too
 * function analyzeCondition(condition: SmartCondition) {
 *   const icd10 = condition.code?.getIcd10Code();
 *   const snomed = condition.code?.getSnomedCode();
 *   // TypeScript autocomplete works perfectly
 * }
 */
export type SmartObservation = Smart<Observation> & ObservationCodingFields;

export type SmartCondition = Smart<Condition> & ConditionCodingFields;

export type SmartProcedure = Smart<Procedure> & ProcedureCodingFields;

export type SmartAllergyIntolerance = Smart<AllergyIntolerance> & AllergyIntoleranceCodingFields;

export type SmartEncounter = Smart<Encounter> & EncounterCodingFields;

export type SmartDiagnosticReport = Smart<DiagnosticReport> & DiagnosticReportCodingFields;

export type SmartImmunization = Smart<Immunization> & ImmunizationCodingFields;

export type SmartMedication = Smart<Medication> & MedicationCodingFields;

export type SmartMedicationRequest = Smart<MedicationRequest> & MedicationRequestCodingFields;

export type SmartMedicationAdministration = Smart<MedicationAdministration> &
  MedicationAdministrationCodingFields;

export type SmartMedicationDispense = Smart<MedicationDispense> & MedicationDispenseCodingFields;

export type SmartMedicationStatement = Smart<MedicationStatement> & MedicationStatementCodingFields;

export type SmartFamilyMemberHistory = Smart<FamilyMemberHistory> & FamilyMemberHistoryCodingFields;

export type SmartRelatedPerson = Smart<RelatedPerson> & RelatedPersonCodingFields;

export type SmartRiskAssessment = Smart<RiskAssessment> & RiskAssessmentCodingFields;

export type SmartServiceRequest = Smart<ServiceRequest> & ServiceRequestCodingFields;

export type SmartCarePlan = Smart<CarePlan> & CarePlanCodingFields;

export type SmartPatient = Smart<Patient> & PatientCodingFields;

export type SmartPractitioner = Smart<Practitioner> & PractitionerCodingFields;

export type SmartOrganization = Smart<Organization> & OrganizationCodingFields;

export type SmartLocation = Smart<Location> & LocationCodingFields;

export type SmartComposition = Smart<Composition> & CompositionCodingFields;

export type SmartCoverage = Smart<Coverage> & CoverageCodingFields;

export type SmartDocumentReference = Smart<DocumentReference> & DocumentReferenceCodingFields;

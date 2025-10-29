import {
  Resource,
  Patient,
  Observation,
  DiagnosticReport,
  Encounter,
  Practitioner,
  PractitionerRole,
  Organization,
  Location,
  AllergyIntolerance,
  Condition,
  Composition,
  Coverage,
  DocumentReference,
  FamilyMemberHistory,
  Immunization,
  Medication,
  MedicationAdministration,
  MedicationDispense,
  MedicationRequest,
  MedicationStatement,
  Procedure,
  RelatedPerson,
  RiskAssessment,
  ServiceRequest,
  CarePlan,
  Bundle,
} from "@medplum/fhirtypes";
import { Smart } from "./types/smart-resources";
import {
  SmartPatient,
  SmartObservation,
  SmartDiagnosticReport,
  SmartEncounter,
  SmartPractitioner,
  SmartOrganization,
  SmartLocation,
  SmartAllergyIntolerance,
  SmartCondition,
  SmartComposition,
  SmartCoverage,
  SmartDocumentReference,
  SmartFamilyMemberHistory,
  SmartImmunization,
  SmartMedication,
  SmartMedicationAdministration,
  SmartMedicationDispense,
  SmartMedicationRequest,
  SmartMedicationStatement,
  SmartProcedure,
  SmartRelatedPerson,
  SmartRiskAssessment,
  SmartServiceRequest,
  SmartCarePlan,
} from "./types/coding-fields";

/**
 * Patient type guard
 * Returns SmartPatient when used with Smart resources to provide full TypeScript support
 * for coding utilities
 */
export function isPatient(resource: Smart<Resource> | undefined): resource is SmartPatient;
export function isPatient(resource: Resource | undefined): resource is Patient;
export function isPatient(
  resource: Resource | Smart<Resource> | undefined
): resource is Patient | SmartPatient {
  return resource?.resourceType === "Patient";
}

/**
 * Observation type guard
 * Returns SmartObservation when used with Smart resources to provide full TypeScript support
 * for coding utilities
 */
export function isObservation(resource: Smart<Resource> | undefined): resource is SmartObservation;
export function isObservation(resource: Resource | undefined): resource is Observation;
export function isObservation(
  resource: Resource | Smart<Resource> | undefined
): resource is Observation | SmartObservation {
  return resource?.resourceType === "Observation";
}

/**
 * DiagnosticReport type guard
 * Returns SmartDiagnosticReport when used with Smart resources to provide full TypeScript support
 * for coding utilities
 */
export function isDiagnosticReport(
  resource: Smart<Resource> | undefined
): resource is SmartDiagnosticReport;
export function isDiagnosticReport(resource: Resource | undefined): resource is DiagnosticReport;
export function isDiagnosticReport(
  resource: Resource | Smart<Resource> | undefined
): resource is DiagnosticReport | SmartDiagnosticReport {
  return resource?.resourceType === "DiagnosticReport";
}

/**
 * Encounter type guard
 * Returns SmartEncounter when used with Smart resources to provide full TypeScript support
 * for coding utilities
 */
export function isEncounter(resource: Smart<Resource> | undefined): resource is SmartEncounter;
export function isEncounter(resource: Resource | undefined): resource is Encounter;
export function isEncounter(
  resource: Resource | Smart<Resource> | undefined
): resource is Encounter | SmartEncounter {
  return resource?.resourceType === "Encounter";
}

/**
 * Practitioner type guard
 * Returns SmartPractitioner when used with Smart resources to provide full TypeScript support
 * for coding utilities
 */
export function isPractitioner(
  resource: Smart<Resource> | undefined
): resource is SmartPractitioner;
export function isPractitioner(resource: Resource | undefined): resource is Practitioner;
export function isPractitioner(
  resource: Resource | Smart<Resource> | undefined
): resource is Practitioner | SmartPractitioner {
  return resource?.resourceType === "Practitioner";
}

/**
 * PractitionerRole type guard
 * Note: PractitionerRole doesn't have specific coding fields, so it uses the generic Smart type
 */
export function isPractitionerRole(
  resource: Smart<Resource> | undefined
): resource is Smart<PractitionerRole>;
export function isPractitionerRole(resource: Resource | undefined): resource is PractitionerRole;
export function isPractitionerRole(
  resource: Resource | Smart<Resource> | undefined
): resource is PractitionerRole | Smart<PractitionerRole> {
  return resource?.resourceType === "PractitionerRole";
}

/**
 * Organization type guard
 * Returns SmartOrganization when used with Smart resources to provide full TypeScript support
 * for coding utilities
 */
export function isOrganization(
  resource: Smart<Resource> | undefined
): resource is SmartOrganization;
export function isOrganization(resource: Resource | undefined): resource is Organization;
export function isOrganization(
  resource: Resource | Smart<Resource> | undefined
): resource is Organization | SmartOrganization {
  return resource?.resourceType === "Organization";
}

/**
 * Location type guard
 * Returns SmartLocation when used with Smart resources to provide full TypeScript support
 * for coding utilities
 */
export function isLocation(resource: Smart<Resource> | undefined): resource is SmartLocation;
export function isLocation(resource: Resource | undefined): resource is Location;
export function isLocation(
  resource: Resource | Smart<Resource> | undefined
): resource is Location | SmartLocation {
  return resource?.resourceType === "Location";
}

/**
 * AllergyIntolerance type guard
 * Returns SmartAllergyIntolerance when used with Smart resources to provide full TypeScript support
 * for coding utilities
 */
export function isAllergyIntolerance(
  resource: Smart<Resource> | undefined
): resource is SmartAllergyIntolerance;
export function isAllergyIntolerance(
  resource: Resource | undefined
): resource is AllergyIntolerance;
export function isAllergyIntolerance(
  resource: Resource | Smart<Resource> | undefined
): resource is AllergyIntolerance | SmartAllergyIntolerance {
  return resource?.resourceType === "AllergyIntolerance";
}

/**
 * Condition type guard
 * Returns SmartCondition when used with Smart resources to provide full TypeScript support
 * for coding utilities
 */
export function isCondition(resource: Smart<Resource> | undefined): resource is SmartCondition;
export function isCondition(resource: Resource | undefined): resource is Condition;
export function isCondition(
  resource: Resource | Smart<Resource> | undefined
): resource is Condition | SmartCondition {
  return resource?.resourceType === "Condition";
}

/**
 * Composition type guard
 * Returns SmartComposition when used with Smart resources to provide full TypeScript support
 * for coding utilities
 */
export function isComposition(resource: Smart<Resource> | undefined): resource is SmartComposition;
export function isComposition(resource: Resource | undefined): resource is Composition;
export function isComposition(
  resource: Resource | Smart<Resource> | undefined
): resource is Composition | SmartComposition {
  return resource?.resourceType === "Composition";
}

/**
 * Coverage type guard
 * Returns SmartCoverage when used with Smart resources to provide full TypeScript support
 * for coding utilities
 */
export function isCoverage(resource: Smart<Resource> | undefined): resource is SmartCoverage;
export function isCoverage(resource: Resource | undefined): resource is Coverage;
export function isCoverage(
  resource: Resource | Smart<Resource> | undefined
): resource is Coverage | SmartCoverage {
  return resource?.resourceType === "Coverage";
}

/**
 * DocumentReference type guard
 * Returns SmartDocumentReference when used with Smart resources to provide full TypeScript support
 * for coding utilities
 */
export function isDocumentReference(
  resource: Smart<Resource> | undefined
): resource is SmartDocumentReference;
export function isDocumentReference(resource: Resource | undefined): resource is DocumentReference;
export function isDocumentReference(
  resource: Resource | Smart<Resource> | undefined
): resource is DocumentReference | SmartDocumentReference {
  return resource?.resourceType === "DocumentReference";
}

/**
 * FamilyMemberHistory type guard
 * Returns SmartFamilyMemberHistory when used with Smart resources to provide full TypeScript support
 * for coding utilities
 */
export function isFamilyMemberHistory(
  resource: Smart<Resource> | undefined
): resource is SmartFamilyMemberHistory;
export function isFamilyMemberHistory(
  resource: Resource | undefined
): resource is FamilyMemberHistory;
export function isFamilyMemberHistory(
  resource: Resource | Smart<Resource> | undefined
): resource is FamilyMemberHistory | SmartFamilyMemberHistory {
  return resource?.resourceType === "FamilyMemberHistory";
}

/**
 * Immunization type guard
 * Returns SmartImmunization when used with Smart resources to provide full TypeScript support
 * for coding utilities
 */
export function isImmunization(
  resource: Smart<Resource> | undefined
): resource is SmartImmunization;
export function isImmunization(resource: Resource | undefined): resource is Immunization;
export function isImmunization(
  resource: Resource | Smart<Resource> | undefined
): resource is Immunization | SmartImmunization {
  return resource?.resourceType === "Immunization";
}

/**
 * Medication type guard
 * Returns SmartMedication when used with Smart resources to provide full TypeScript support
 * for coding utilities
 */
export function isMedication(resource: Smart<Resource> | undefined): resource is SmartMedication;
export function isMedication(resource: Resource | undefined): resource is Medication;
export function isMedication(
  resource: Resource | Smart<Resource> | undefined
): resource is Medication | SmartMedication {
  return resource?.resourceType === "Medication";
}

/**
 * MedicationAdministration type guard
 * Returns SmartMedicationAdministration when used with Smart resources to provide full TypeScript support
 * for coding utilities
 */
export function isMedicationAdministration(
  resource: Smart<Resource> | undefined
): resource is SmartMedicationAdministration;
export function isMedicationAdministration(
  resource: Resource | undefined
): resource is MedicationAdministration;
export function isMedicationAdministration(
  resource: Resource | Smart<Resource> | undefined
): resource is MedicationAdministration | SmartMedicationAdministration {
  return resource?.resourceType === "MedicationAdministration";
}

/**
 * MedicationDispense type guard
 * Returns SmartMedicationDispense when used with Smart resources to provide full TypeScript support
 * for coding utilities
 */
export function isMedicationDispense(
  resource: Smart<Resource> | undefined
): resource is SmartMedicationDispense;
export function isMedicationDispense(
  resource: Resource | undefined
): resource is MedicationDispense;
export function isMedicationDispense(
  resource: Resource | Smart<Resource> | undefined
): resource is MedicationDispense | SmartMedicationDispense {
  return resource?.resourceType === "MedicationDispense";
}

/**
 * MedicationRequest type guard
 * Returns SmartMedicationRequest when used with Smart resources to provide full TypeScript support
 * for coding utilities
 */
export function isMedicationRequest(
  resource: Smart<Resource> | undefined
): resource is SmartMedicationRequest;
export function isMedicationRequest(resource: Resource | undefined): resource is MedicationRequest;
export function isMedicationRequest(
  resource: Resource | Smart<Resource> | undefined
): resource is MedicationRequest | SmartMedicationRequest {
  return resource?.resourceType === "MedicationRequest";
}

/**
 * MedicationStatement type guard
 * Returns SmartMedicationStatement when used with Smart resources to provide full TypeScript support
 * for coding utilities
 */
export function isMedicationStatement(
  resource: Smart<Resource> | undefined
): resource is SmartMedicationStatement;
export function isMedicationStatement(
  resource: Resource | undefined
): resource is MedicationStatement;
export function isMedicationStatement(
  resource: Resource | Smart<Resource> | undefined
): resource is MedicationStatement | SmartMedicationStatement {
  return resource?.resourceType === "MedicationStatement";
}

/**
 * Procedure type guard
 * Returns SmartProcedure when used with Smart resources to provide full TypeScript support
 * for coding utilities
 */
export function isProcedure(resource: Smart<Resource> | undefined): resource is SmartProcedure;
export function isProcedure(resource: Resource | undefined): resource is Procedure;
export function isProcedure(
  resource: Resource | Smart<Resource> | undefined
): resource is Procedure | SmartProcedure {
  return resource?.resourceType === "Procedure";
}

/**
 * RelatedPerson type guard
 * Returns SmartRelatedPerson when used with Smart resources to provide full TypeScript support
 * for coding utilities
 */
export function isRelatedPerson(
  resource: Smart<Resource> | undefined
): resource is SmartRelatedPerson;
export function isRelatedPerson(resource: Resource | undefined): resource is RelatedPerson;
export function isRelatedPerson(
  resource: Resource | Smart<Resource> | undefined
): resource is RelatedPerson | SmartRelatedPerson {
  return resource?.resourceType === "RelatedPerson";
}

/**
 * RiskAssessment type guard
 * Returns SmartRiskAssessment when used with Smart resources to provide full TypeScript support
 * for coding utilities
 */
export function isRiskAssessment(
  resource: Smart<Resource> | undefined
): resource is SmartRiskAssessment;
export function isRiskAssessment(resource: Resource | undefined): resource is RiskAssessment;
export function isRiskAssessment(
  resource: Resource | Smart<Resource> | undefined
): resource is RiskAssessment | SmartRiskAssessment {
  return resource?.resourceType === "RiskAssessment";
}

/**
 * ServiceRequest type guard
 * Returns SmartServiceRequest when used with Smart resources to provide full TypeScript support
 * for coding utilities
 */
export function isServiceRequest(
  resource: Smart<Resource> | undefined
): resource is SmartServiceRequest;
export function isServiceRequest(resource: Resource | undefined): resource is ServiceRequest;
export function isServiceRequest(
  resource: Resource | Smart<Resource> | undefined
): resource is ServiceRequest | SmartServiceRequest {
  return resource?.resourceType === "ServiceRequest";
}

/**
 * CarePlan type guard
 * Returns SmartCarePlan when used with Smart resources to provide full TypeScript support
 * for coding utilities
 */
export function isCarePlan(resource: Smart<Resource> | undefined): resource is SmartCarePlan;
export function isCarePlan(resource: Resource | undefined): resource is CarePlan;
export function isCarePlan(
  resource: Resource | Smart<Resource> | undefined
): resource is CarePlan | SmartCarePlan {
  return resource?.resourceType === "CarePlan";
}

/**
 * Bundle type guard
 */
export function isBundle(resource: Smart<Resource> | undefined): resource is Smart<Bundle>;
export function isBundle(resource: Resource | undefined): resource is Bundle;
export function isBundle(
  resource: Resource | Smart<Resource> | undefined
): resource is Bundle | Smart<Bundle> {
  return resource?.resourceType === "Bundle";
}

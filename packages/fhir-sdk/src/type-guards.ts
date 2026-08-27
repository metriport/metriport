import type {
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
import type { Smart } from "./types/smart-resources";
import type {
  SmartPatient,
  SmartObservation,
  SmartDiagnosticReport,
  SmartEncounter,
  SmartPractitioner,
  SmartPractitionerRole,
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

// =============================================================================
// Smart Resource Type Guards (for SDK resources)
// =============================================================================

/**
 * Patient type guard for Smart resources
 */
export function isPatient(resource: Smart<Resource> | undefined): resource is SmartPatient {
  return resource?.resourceType === "Patient";
}

/**
 * Observation type guard for Smart resources
 */
export function isObservation(resource: Smart<Resource> | undefined): resource is SmartObservation {
  return resource?.resourceType === "Observation";
}

/**
 * DiagnosticReport type guard for Smart resources
 */
export function isDiagnosticReport(
  resource: Smart<Resource> | undefined
): resource is SmartDiagnosticReport {
  return resource?.resourceType === "DiagnosticReport";
}

/**
 * Encounter type guard for Smart resources
 */
export function isEncounter(resource: Smart<Resource> | undefined): resource is SmartEncounter {
  return resource?.resourceType === "Encounter";
}

/**
 * Practitioner type guard for Smart resources
 */
export function isPractitioner(
  resource: Smart<Resource> | undefined
): resource is SmartPractitioner {
  return resource?.resourceType === "Practitioner";
}

/**
 * PractitionerRole type guard for Smart resources
 */
export function isPractitionerRole(
  resource: Smart<Resource> | undefined
): resource is SmartPractitionerRole {
  return resource?.resourceType === "PractitionerRole";
}

/**
 * Organization type guard for Smart resources
 */
export function isOrganization(
  resource: Smart<Resource> | undefined
): resource is SmartOrganization {
  return resource?.resourceType === "Organization";
}

/**
 * Location type guard for Smart resources
 */
export function isLocation(resource: Smart<Resource> | undefined): resource is SmartLocation {
  return resource?.resourceType === "Location";
}

/**
 * AllergyIntolerance type guard for Smart resources
 */
export function isAllergyIntolerance(
  resource: Smart<Resource> | undefined
): resource is SmartAllergyIntolerance {
  return resource?.resourceType === "AllergyIntolerance";
}

/**
 * Condition type guard for Smart resources
 */
export function isCondition(resource: Smart<Resource> | undefined): resource is SmartCondition {
  return resource?.resourceType === "Condition";
}

/**
 * Composition type guard for Smart resources
 */
export function isComposition(resource: Smart<Resource> | undefined): resource is SmartComposition {
  return resource?.resourceType === "Composition";
}

/**
 * Coverage type guard for Smart resources
 */
export function isCoverage(resource: Smart<Resource> | undefined): resource is SmartCoverage {
  return resource?.resourceType === "Coverage";
}

/**
 * DocumentReference type guard for Smart resources
 */
export function isDocumentReference(
  resource: Smart<Resource> | undefined
): resource is SmartDocumentReference {
  return resource?.resourceType === "DocumentReference";
}

/**
 * FamilyMemberHistory type guard for Smart resources
 */
export function isFamilyMemberHistory(
  resource: Smart<Resource> | undefined
): resource is SmartFamilyMemberHistory {
  return resource?.resourceType === "FamilyMemberHistory";
}

/**
 * Immunization type guard for Smart resources
 */
export function isImmunization(
  resource: Smart<Resource> | undefined
): resource is SmartImmunization {
  return resource?.resourceType === "Immunization";
}

/**
 * Medication type guard for Smart resources
 */
export function isMedication(resource: Smart<Resource> | undefined): resource is SmartMedication {
  return resource?.resourceType === "Medication";
}

/**
 * MedicationAdministration type guard for Smart resources
 */
export function isMedicationAdministration(
  resource: Smart<Resource> | undefined
): resource is SmartMedicationAdministration {
  return resource?.resourceType === "MedicationAdministration";
}

/**
 * MedicationDispense type guard for Smart resources
 */
export function isMedicationDispense(
  resource: Smart<Resource> | undefined
): resource is SmartMedicationDispense {
  return resource?.resourceType === "MedicationDispense";
}

/**
 * MedicationRequest type guard for Smart resources
 */
export function isMedicationRequest(
  resource: Smart<Resource> | undefined
): resource is SmartMedicationRequest {
  return resource?.resourceType === "MedicationRequest";
}

/**
 * MedicationStatement type guard for Smart resources
 */
export function isMedicationStatement(
  resource: Smart<Resource> | undefined
): resource is SmartMedicationStatement {
  return resource?.resourceType === "MedicationStatement";
}

/**
 * Procedure type guard for Smart resources
 */
export function isProcedure(resource: Smart<Resource> | undefined): resource is SmartProcedure {
  return resource?.resourceType === "Procedure";
}

/**
 * RelatedPerson type guard for Smart resources
 */
export function isRelatedPerson(
  resource: Smart<Resource> | undefined
): resource is SmartRelatedPerson {
  return resource?.resourceType === "RelatedPerson";
}

/**
 * RiskAssessment type guard for Smart resources
 */
export function isRiskAssessment(
  resource: Smart<Resource> | undefined
): resource is SmartRiskAssessment {
  return resource?.resourceType === "RiskAssessment";
}

/**
 * ServiceRequest type guard for Smart resources
 */
export function isServiceRequest(
  resource: Smart<Resource> | undefined
): resource is SmartServiceRequest {
  return resource?.resourceType === "ServiceRequest";
}

/**
 * CarePlan type guard for Smart resources
 */
export function isCarePlan(resource: Smart<Resource> | undefined): resource is SmartCarePlan {
  return resource?.resourceType === "CarePlan";
}

/**
 * Bundle type guard for Smart resources
 */
export function isBundle(resource: Smart<Resource> | undefined): resource is Smart<Bundle> {
  return resource?.resourceType === "Bundle";
}

// =============================================================================
// Plain FHIR Resource Type Guards
// =============================================================================

/**
 * Patient type guard for plain FHIR resources
 */
export function isPlainPatient(resource: Resource | undefined): resource is Patient {
  return resource?.resourceType === "Patient";
}

/**
 * Observation type guard for plain FHIR resources
 */
export function isPlainObservation(resource: Resource | undefined): resource is Observation {
  return resource?.resourceType === "Observation";
}

/**
 * DiagnosticReport type guard for plain FHIR resources
 */
export function isPlainDiagnosticReport(
  resource: Resource | undefined
): resource is DiagnosticReport {
  return resource?.resourceType === "DiagnosticReport";
}

/**
 * Encounter type guard for plain FHIR resources
 */
export function isPlainEncounter(resource: Resource | undefined): resource is Encounter {
  return resource?.resourceType === "Encounter";
}

/**
 * Practitioner type guard for plain FHIR resources
 */
export function isPlainPractitioner(resource: Resource | undefined): resource is Practitioner {
  return resource?.resourceType === "Practitioner";
}

/**
 * PractitionerRole type guard for plain FHIR resources
 */
export function isPlainPractitionerRole(
  resource: Resource | undefined
): resource is PractitionerRole {
  return resource?.resourceType === "PractitionerRole";
}

/**
 * Organization type guard for plain FHIR resources
 */
export function isPlainOrganization(resource: Resource | undefined): resource is Organization {
  return resource?.resourceType === "Organization";
}

/**
 * Location type guard for plain FHIR resources
 */
export function isPlainLocation(resource: Resource | undefined): resource is Location {
  return resource?.resourceType === "Location";
}

/**
 * AllergyIntolerance type guard for plain FHIR resources
 */
export function isPlainAllergyIntolerance(
  resource: Resource | undefined
): resource is AllergyIntolerance {
  return resource?.resourceType === "AllergyIntolerance";
}

/**
 * Condition type guard for plain FHIR resources
 */
export function isPlainCondition(resource: Resource | undefined): resource is Condition {
  return resource?.resourceType === "Condition";
}

/**
 * Composition type guard for plain FHIR resources
 */
export function isPlainComposition(resource: Resource | undefined): resource is Composition {
  return resource?.resourceType === "Composition";
}

/**
 * Coverage type guard for plain FHIR resources
 */
export function isPlainCoverage(resource: Resource | undefined): resource is Coverage {
  return resource?.resourceType === "Coverage";
}

/**
 * DocumentReference type guard for plain FHIR resources
 */
export function isPlainDocumentReference(
  resource: Resource | undefined
): resource is DocumentReference {
  return resource?.resourceType === "DocumentReference";
}

/**
 * FamilyMemberHistory type guard for plain FHIR resources
 */
export function isPlainFamilyMemberHistory(
  resource: Resource | undefined
): resource is FamilyMemberHistory {
  return resource?.resourceType === "FamilyMemberHistory";
}

/**
 * Immunization type guard for plain FHIR resources
 */
export function isPlainImmunization(resource: Resource | undefined): resource is Immunization {
  return resource?.resourceType === "Immunization";
}

/**
 * Medication type guard for plain FHIR resources
 */
export function isPlainMedication(resource: Resource | undefined): resource is Medication {
  return resource?.resourceType === "Medication";
}

/**
 * MedicationAdministration type guard for plain FHIR resources
 */
export function isPlainMedicationAdministration(
  resource: Resource | undefined
): resource is MedicationAdministration {
  return resource?.resourceType === "MedicationAdministration";
}

/**
 * MedicationDispense type guard for plain FHIR resources
 */
export function isPlainMedicationDispense(
  resource: Resource | undefined
): resource is MedicationDispense {
  return resource?.resourceType === "MedicationDispense";
}

/**
 * MedicationRequest type guard for plain FHIR resources
 */
export function isPlainMedicationRequest(
  resource: Resource | undefined
): resource is MedicationRequest {
  return resource?.resourceType === "MedicationRequest";
}

/**
 * MedicationStatement type guard for plain FHIR resources
 */
export function isPlainMedicationStatement(
  resource: Resource | undefined
): resource is MedicationStatement {
  return resource?.resourceType === "MedicationStatement";
}

/**
 * Procedure type guard for plain FHIR resources
 */
export function isPlainProcedure(resource: Resource | undefined): resource is Procedure {
  return resource?.resourceType === "Procedure";
}

/**
 * RelatedPerson type guard for plain FHIR resources
 */
export function isPlainRelatedPerson(resource: Resource | undefined): resource is RelatedPerson {
  return resource?.resourceType === "RelatedPerson";
}

/**
 * RiskAssessment type guard for plain FHIR resources
 */
export function isPlainRiskAssessment(resource: Resource | undefined): resource is RiskAssessment {
  return resource?.resourceType === "RiskAssessment";
}

/**
 * ServiceRequest type guard for plain FHIR resources
 */
export function isPlainServiceRequest(resource: Resource | undefined): resource is ServiceRequest {
  return resource?.resourceType === "ServiceRequest";
}

/**
 * CarePlan type guard for plain FHIR resources
 */
export function isPlainCarePlan(resource: Resource | undefined): resource is CarePlan {
  return resource?.resourceType === "CarePlan";
}

/**
 * Bundle type guard for plain FHIR resources
 */
export function isPlainBundle(resource: Resource | undefined): resource is Bundle {
  return resource?.resourceType === "Bundle";
}

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

/**
 * Patient type guard
 */
export function isPatient(resource: Smart<Resource> | undefined): resource is Smart<Patient>;
export function isPatient(resource: Resource | undefined): resource is Patient;
export function isPatient(
  resource: Resource | Smart<Resource> | undefined
): resource is Patient | Smart<Patient> {
  return resource?.resourceType === "Patient";
}

/**
 * Observation type guard
 */
export function isObservation(
  resource: Smart<Resource> | undefined
): resource is Smart<Observation>;
export function isObservation(resource: Resource | undefined): resource is Observation;
export function isObservation(
  resource: Resource | Smart<Resource> | undefined
): resource is Observation | Smart<Observation> {
  return resource?.resourceType === "Observation";
}

/**
 * DiagnosticReport type guard
 */
export function isDiagnosticReport(
  resource: Smart<Resource> | undefined
): resource is Smart<DiagnosticReport>;
export function isDiagnosticReport(resource: Resource | undefined): resource is DiagnosticReport;
export function isDiagnosticReport(
  resource: Resource | Smart<Resource> | undefined
): resource is DiagnosticReport | Smart<DiagnosticReport> {
  return resource?.resourceType === "DiagnosticReport";
}

/**
 * Encounter type guard
 */
export function isEncounter(resource: Smart<Resource> | undefined): resource is Smart<Encounter>;
export function isEncounter(resource: Resource | undefined): resource is Encounter;
export function isEncounter(
  resource: Resource | Smart<Resource> | undefined
): resource is Encounter | Smart<Encounter> {
  return resource?.resourceType === "Encounter";
}

/**
 * Practitioner type guard
 */
export function isPractitioner(
  resource: Smart<Resource> | undefined
): resource is Smart<Practitioner>;
export function isPractitioner(resource: Resource | undefined): resource is Practitioner;
export function isPractitioner(
  resource: Resource | Smart<Resource> | undefined
): resource is Practitioner | Smart<Practitioner> {
  return resource?.resourceType === "Practitioner";
}

/**
 * PractitionerRole type guard
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
 */
export function isOrganization(
  resource: Smart<Resource> | undefined
): resource is Smart<Organization>;
export function isOrganization(resource: Resource | undefined): resource is Organization;
export function isOrganization(
  resource: Resource | Smart<Resource> | undefined
): resource is Organization | Smart<Organization> {
  return resource?.resourceType === "Organization";
}

/**
 * Location type guard
 */
export function isLocation(resource: Smart<Resource> | undefined): resource is Smart<Location>;
export function isLocation(resource: Resource | undefined): resource is Location;
export function isLocation(
  resource: Resource | Smart<Resource> | undefined
): resource is Location | Smart<Location> {
  return resource?.resourceType === "Location";
}

/**
 * AllergyIntolerance type guard
 */
export function isAllergyIntolerance(
  resource: Smart<Resource> | undefined
): resource is Smart<AllergyIntolerance>;
export function isAllergyIntolerance(
  resource: Resource | undefined
): resource is AllergyIntolerance;
export function isAllergyIntolerance(
  resource: Resource | Smart<Resource> | undefined
): resource is AllergyIntolerance | Smart<AllergyIntolerance> {
  return resource?.resourceType === "AllergyIntolerance";
}

/**
 * Condition type guard
 */
export function isCondition(resource: Smart<Resource> | undefined): resource is Smart<Condition>;
export function isCondition(resource: Resource | undefined): resource is Condition;
export function isCondition(
  resource: Resource | Smart<Resource> | undefined
): resource is Condition | Smart<Condition> {
  return resource?.resourceType === "Condition";
}

/**
 * Composition type guard
 */
export function isComposition(
  resource: Smart<Resource> | undefined
): resource is Smart<Composition>;
export function isComposition(resource: Resource | undefined): resource is Composition;
export function isComposition(
  resource: Resource | Smart<Resource> | undefined
): resource is Composition | Smart<Composition> {
  return resource?.resourceType === "Composition";
}

/**
 * Coverage type guard
 */
export function isCoverage(resource: Smart<Resource> | undefined): resource is Smart<Coverage>;
export function isCoverage(resource: Resource | undefined): resource is Coverage;
export function isCoverage(
  resource: Resource | Smart<Resource> | undefined
): resource is Coverage | Smart<Coverage> {
  return resource?.resourceType === "Coverage";
}

/**
 * DocumentReference type guard
 */
export function isDocumentReference(
  resource: Smart<Resource> | undefined
): resource is Smart<DocumentReference>;
export function isDocumentReference(resource: Resource | undefined): resource is DocumentReference;
export function isDocumentReference(
  resource: Resource | Smart<Resource> | undefined
): resource is DocumentReference | Smart<DocumentReference> {
  return resource?.resourceType === "DocumentReference";
}

/**
 * FamilyMemberHistory type guard
 */
export function isFamilyMemberHistory(
  resource: Smart<Resource> | undefined
): resource is Smart<FamilyMemberHistory>;
export function isFamilyMemberHistory(
  resource: Resource | undefined
): resource is FamilyMemberHistory;
export function isFamilyMemberHistory(
  resource: Resource | Smart<Resource> | undefined
): resource is FamilyMemberHistory | Smart<FamilyMemberHistory> {
  return resource?.resourceType === "FamilyMemberHistory";
}

/**
 * Immunization type guard
 */
export function isImmunization(
  resource: Smart<Resource> | undefined
): resource is Smart<Immunization>;
export function isImmunization(resource: Resource | undefined): resource is Immunization;
export function isImmunization(
  resource: Resource | Smart<Resource> | undefined
): resource is Immunization | Smart<Immunization> {
  return resource?.resourceType === "Immunization";
}

/**
 * Medication type guard
 */
export function isMedication(resource: Smart<Resource> | undefined): resource is Smart<Medication>;
export function isMedication(resource: Resource | undefined): resource is Medication;
export function isMedication(
  resource: Resource | Smart<Resource> | undefined
): resource is Medication | Smart<Medication> {
  return resource?.resourceType === "Medication";
}

/**
 * MedicationAdministration type guard
 */
export function isMedicationAdministration(
  resource: Smart<Resource> | undefined
): resource is Smart<MedicationAdministration>;
export function isMedicationAdministration(
  resource: Resource | undefined
): resource is MedicationAdministration;
export function isMedicationAdministration(
  resource: Resource | Smart<Resource> | undefined
): resource is MedicationAdministration | Smart<MedicationAdministration> {
  return resource?.resourceType === "MedicationAdministration";
}

/**
 * MedicationDispense type guard
 */
export function isMedicationDispense(
  resource: Smart<Resource> | undefined
): resource is Smart<MedicationDispense>;
export function isMedicationDispense(
  resource: Resource | undefined
): resource is MedicationDispense;
export function isMedicationDispense(
  resource: Resource | Smart<Resource> | undefined
): resource is MedicationDispense | Smart<MedicationDispense> {
  return resource?.resourceType === "MedicationDispense";
}

/**
 * MedicationRequest type guard
 */
export function isMedicationRequest(
  resource: Smart<Resource> | undefined
): resource is Smart<MedicationRequest>;
export function isMedicationRequest(resource: Resource | undefined): resource is MedicationRequest;
export function isMedicationRequest(
  resource: Resource | Smart<Resource> | undefined
): resource is MedicationRequest | Smart<MedicationRequest> {
  return resource?.resourceType === "MedicationRequest";
}

/**
 * MedicationStatement type guard
 */
export function isMedicationStatement(
  resource: Smart<Resource> | undefined
): resource is Smart<MedicationStatement>;
export function isMedicationStatement(
  resource: Resource | undefined
): resource is MedicationStatement;
export function isMedicationStatement(
  resource: Resource | Smart<Resource> | undefined
): resource is MedicationStatement | Smart<MedicationStatement> {
  return resource?.resourceType === "MedicationStatement";
}

/**
 * Procedure type guard
 */
export function isProcedure(resource: Smart<Resource> | undefined): resource is Smart<Procedure>;
export function isProcedure(resource: Resource | undefined): resource is Procedure;
export function isProcedure(
  resource: Resource | Smart<Resource> | undefined
): resource is Procedure | Smart<Procedure> {
  return resource?.resourceType === "Procedure";
}

/**
 * RelatedPerson type guard
 */
export function isRelatedPerson(
  resource: Smart<Resource> | undefined
): resource is Smart<RelatedPerson>;
export function isRelatedPerson(resource: Resource | undefined): resource is RelatedPerson;
export function isRelatedPerson(
  resource: Resource | Smart<Resource> | undefined
): resource is RelatedPerson | Smart<RelatedPerson> {
  return resource?.resourceType === "RelatedPerson";
}

/**
 * RiskAssessment type guard
 */
export function isRiskAssessment(
  resource: Smart<Resource> | undefined
): resource is Smart<RiskAssessment>;
export function isRiskAssessment(resource: Resource | undefined): resource is RiskAssessment;
export function isRiskAssessment(
  resource: Resource | Smart<Resource> | undefined
): resource is RiskAssessment | Smart<RiskAssessment> {
  return resource?.resourceType === "RiskAssessment";
}

/**
 * ServiceRequest type guard
 */
export function isServiceRequest(
  resource: Smart<Resource> | undefined
): resource is Smart<ServiceRequest>;
export function isServiceRequest(resource: Resource | undefined): resource is ServiceRequest;
export function isServiceRequest(
  resource: Resource | Smart<Resource> | undefined
): resource is ServiceRequest | Smart<ServiceRequest> {
  return resource?.resourceType === "ServiceRequest";
}

/**
 * CarePlan type guard
 */
export function isCarePlan(resource: Smart<Resource> | undefined): resource is Smart<CarePlan>;
export function isCarePlan(resource: Resource | undefined): resource is CarePlan;
export function isCarePlan(
  resource: Resource | Smart<Resource> | undefined
): resource is CarePlan | Smart<CarePlan> {
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

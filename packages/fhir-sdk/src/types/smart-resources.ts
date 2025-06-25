import {
  Resource,
  Patient,
  Observation,
  Encounter,
  Practitioner,
  PractitionerRole,
  Organization,
  CareTeam,
  RelatedPerson,
  DiagnosticReport,
  Group,
  Device,
  Location,
} from "@medplum/fhirtypes";

/**
 * Base interface for smart resources - all smart resources have these capabilities
 */
export interface SmartResourceBase {
  // Marker property to identify smart resources
  readonly __isSmartResource: true;
}

/**
 * Generic type that converts any Resource to a SmartResource
 */
export type SmartResource<T extends Resource> = T & SmartResourceBase & ReferenceMethodsFor<T>;

/**
 * Reference methods for Observation resources
 */
export interface ObservationReferenceMethods {
  getSubject(): SmartResource<Patient | Group | Device | Location> | undefined;
  getEncounter(): SmartResource<Encounter> | undefined;
  getPerformer(): SmartResource<
    Practitioner | PractitionerRole | Organization | CareTeam | Patient | RelatedPerson
  >[];
}

/**
 * Reference methods for Encounter resources
 */
export interface EncounterReferenceMethods {
  getSubject(): SmartResource<Patient | Group> | undefined;
  getParticipant(): SmartResource<Practitioner | PractitionerRole | RelatedPerson | Device>[];
}

/**
 * Reference methods for DiagnosticReport resources
 */
export interface DiagnosticReportReferenceMethods {
  getSubject(): SmartResource<Patient | Group | Device | Location> | undefined;
  getResult(): SmartResource<Observation>[];
  getPerformer(): SmartResource<Practitioner | PractitionerRole | Organization | CareTeam>[];
}

/**
 * Reference methods for Patient resources
 */
export interface PatientReferenceMethods {
  getGeneralPractitioner(): SmartResource<Practitioner | PractitionerRole | Organization>[];
  getManagingOrganization(): SmartResource<Organization> | undefined;
}

/**
 * Reference methods for Practitioner resources
 */
// eslint-disable-next-line @typescript-eslint/no-empty-interface
export interface PractitionerReferenceMethods {
  // Most Practitioner references are reverse lookups, but we can add organization if needed
}

/**
 * Base reference methods for resources that don't have specific reference patterns
 */
// eslint-disable-next-line @typescript-eslint/no-empty-interface
export interface BaseReferenceMethods {
  // Empty for now, could add common methods if needed
}

/**
 * Conditional type that maps resource types to their reference methods
 */
export type ReferenceMethodsFor<T extends Resource> = T extends Observation
  ? ObservationReferenceMethods
  : T extends Encounter
  ? EncounterReferenceMethods
  : T extends DiagnosticReport
  ? DiagnosticReportReferenceMethods
  : T extends Patient
  ? PatientReferenceMethods
  : T extends Practitioner
  ? PractitionerReferenceMethods
  : BaseReferenceMethods;

/**
 * Specific smart resource types for common use cases
 */
export type SmartObservation = SmartResource<Observation>;
export type SmartEncounter = SmartResource<Encounter>;
export type SmartDiagnosticReport = SmartResource<DiagnosticReport>;
export type SmartPatient = SmartResource<Patient>;
export type SmartPractitioner = SmartResource<Practitioner>;

/**
 * Reference field mapping - maps reference method names to their field paths
 */
export const REFERENCE_METHOD_MAPPING: Record<string, Record<string, string>> = {
  Observation: {
    getSubject: "subject",
    getEncounter: "encounter",
    getPerformer: "performer",
  },
  Encounter: {
    getSubject: "subject",
    getParticipant: "participant",
  },
  DiagnosticReport: {
    getSubject: "subject",
    getResult: "result",
    getPerformer: "performer",
  },
  Patient: {
    getGeneralPractitioner: "generalPractitioner",
    getManagingOrganization: "managingOrganization",
  },
};

/**
 * Helper type to check if a method name is a valid reference method for a resource type
 */
export function isReferenceMethod(methodName: string, resourceType: string): boolean {
  const mapping = REFERENCE_METHOD_MAPPING[resourceType];
  return mapping ? methodName in mapping : false;
}

/**
 * Get the reference field path for a method name and resource type
 */
export function getReferenceField(methodName: string, resourceType: string): string | undefined {
  const mapping = REFERENCE_METHOD_MAPPING[resourceType];
  return mapping ? mapping[methodName] : undefined;
}

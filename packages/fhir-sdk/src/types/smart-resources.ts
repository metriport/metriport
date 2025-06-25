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
 * Generic type that converts any Resource to a Smart resource
 */
export type Smart<T extends Resource> = T & SmartResourceBase & ReferenceMethodsFor<T>;

/**
 * Reference methods for Observation resources
 */
export interface ObservationReferenceMethods {
  getSubject(): Smart<Patient | Group | Device | Location> | undefined;
  getEncounter(): Smart<Encounter> | undefined;
  getPerformer(): Smart<
    Practitioner | PractitionerRole | Organization | CareTeam | Patient | RelatedPerson
  >[];
}

/**
 * Reference methods for Encounter resources
 */
export interface EncounterReferenceMethods {
  getSubject(): Smart<Patient | Group> | undefined;
  getParticipant(): Smart<Practitioner | PractitionerRole | RelatedPerson | Device>[];
}

/**
 * Reference methods for DiagnosticReport resources
 */
export interface DiagnosticReportReferenceMethods {
  getSubject(): Smart<Patient | Group | Device | Location> | undefined;
  getResult(): Smart<Observation>[];
  getPerformer(): Smart<Practitioner | PractitionerRole | Organization | CareTeam>[];
}

/**
 * Reference methods for Patient resources
 */
export interface PatientReferenceMethods {
  getGeneralPractitioner(): Smart<Practitioner | PractitionerRole | Organization>[];
  getManagingOrganization(): Smart<Organization> | undefined;
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
 * Note: We only use the generic Smart<T> pattern for consistency.
 * Specific type aliases like SmartObservation are not needed since
 * Smart<Observation> provides the same functionality.
 */

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

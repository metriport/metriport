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
  RiskAssessment,
  ServiceRequest,
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
  getSubject<T extends Patient | Group | Device | Location>(): Smart<T> | undefined;
  getEncounter(): Smart<Encounter> | undefined;
  getPerformer<
    T extends Practitioner | PractitionerRole | Organization | CareTeam | Patient | RelatedPerson
  >(): Smart<T>[];
}

/**
 * Reference methods for Encounter resources
 */
export interface EncounterReferenceMethods {
  getSubject<T extends Patient | Group>(): Smart<T> | undefined;
  getParticipant<T extends Practitioner | PractitionerRole | RelatedPerson | Device>(): Smart<T>[];
}

/**
 * Reference methods for DiagnosticReport resources
 */
export interface DiagnosticReportReferenceMethods {
  getSubject<T extends Patient | Group | Device | Location>(): Smart<T> | undefined;
  getResult(): Smart<Observation>[];
  getPerformer<T extends Practitioner | PractitionerRole | Organization | CareTeam>(): Smart<T>[];
}

/**
 * Reference methods for Patient resources
 */
export interface PatientReferenceMethods {
  getGeneralPractitioner<T extends Practitioner | PractitionerRole | Organization>(): Smart<T>[];
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
 * Reference methods for AllergyIntolerance resources
 */
export interface AllergyIntoleranceReferenceMethods {
  getPatient(): Smart<Patient> | undefined;
  getEncounter(): Smart<Encounter> | undefined;
  getRecorder<T extends Practitioner | PractitionerRole | Patient | RelatedPerson>():
    | Smart<T>
    | undefined;
  getAsserter<T extends Patient | RelatedPerson | Practitioner | PractitionerRole>():
    | Smart<T>
    | undefined;
}

/**
 * Reference methods for Condition resources
 */
export interface ConditionReferenceMethods {
  getSubject<T extends Patient | Group>(): Smart<T> | undefined;
  getEncounter(): Smart<Encounter> | undefined;
  getRecorder<T extends Practitioner | PractitionerRole | Patient | RelatedPerson>():
    | Smart<T>
    | undefined;
  getAsserter<T extends Practitioner | PractitionerRole | Patient | RelatedPerson>():
    | Smart<T>
    | undefined;
}

/**
 * Reference methods for Organization resources
 */
export interface OrganizationReferenceMethods {
  getPartOf(): Smart<Organization> | undefined;
}

/**
 * Reference methods for Location resources
 */
export interface LocationReferenceMethods {
  getManagingOrganization(): Smart<Organization> | undefined;
  getPartOf(): Smart<Location> | undefined;
}

/**
 * Reference methods for Composition resources
 */
export interface CompositionReferenceMethods {
  getSubject<T extends Patient | Group | Device | Location>(): Smart<T> | undefined;
  getEncounter(): Smart<Encounter> | undefined;
  getAuthor<
    T extends Practitioner | PractitionerRole | Device | Patient | RelatedPerson | Organization
  >(): Smart<T>[];
  getCustodian(): Smart<Organization> | undefined;
}

/**
 * Reference methods for Coverage resources
 */
export interface CoverageReferenceMethods {
  getBeneficiary(): Smart<Patient> | undefined;
  getSubscriber<T extends Patient | RelatedPerson>(): Smart<T> | undefined;
  getPayor<T extends Organization | Patient | RelatedPerson>(): Smart<T>[];
  getPolicyHolder<T extends Patient | RelatedPerson | Organization>(): Smart<T> | undefined;
}

/**
 * Reference methods for DocumentReference resources
 */
export interface DocumentReferenceReferenceMethods {
  getSubject<T extends Patient | Group | Practitioner | PractitionerRole | Device>():
    | Smart<T>
    | undefined;
  getAuthor<
    T extends Practitioner | PractitionerRole | Organization | Device | Patient | RelatedPerson
  >(): Smart<T>[];
  getAuthenticator<T extends Practitioner | PractitionerRole | Organization>():
    | Smart<T>
    | undefined;
  getCustodian(): Smart<Organization> | undefined;
}

/**
 * Reference methods for Immunization resources
 */
export interface ImmunizationReferenceMethods {
  getPatient(): Smart<Patient> | undefined;
  getEncounter(): Smart<Encounter> | undefined;
  getPerformer<T extends Practitioner | PractitionerRole | Organization>(): Smart<T>[];
}

/**
 * Reference methods for Medication resources
 */
export interface MedicationReferenceMethods {
  getManufacturer(): Smart<Organization> | undefined;
}

/**
 * Reference methods for MedicationRequest resources
 */
export interface MedicationRequestReferenceMethods {
  getSubject<T extends Patient | Group>(): Smart<T> | undefined;
  getEncounter(): Smart<Encounter> | undefined;
  getRequester<
    T extends Practitioner | PractitionerRole | Organization | Patient | RelatedPerson | Device
  >(): Smart<T> | undefined;
  getPerformer<
    T extends
      | Practitioner
      | PractitionerRole
      | Organization
      | Patient
      | Device
      | RelatedPerson
      | CareTeam
  >(): Smart<T> | undefined;
  getMedicationReference(): Smart<Medication> | undefined;
}

/**
 * Reference methods for Procedure resources
 */
export interface ProcedureReferenceMethods {
  getSubject<T extends Patient | Group>(): Smart<T> | undefined;
  getEncounter(): Smart<Encounter> | undefined;
  getPerformer<
    T extends Practitioner | PractitionerRole | Organization | Patient | RelatedPerson | Device
  >(): Smart<T>[];
}

/**
 * Reference methods for FamilyMemberHistory resources
 */
export interface FamilyMemberHistoryReferenceMethods {
  getPatient(): Smart<Patient> | undefined;
}

/**
 * Reference methods for MedicationAdministration resources
 */
export interface MedicationAdministrationReferenceMethods {
  getSubject<T extends Patient | Group>(): Smart<T> | undefined;
  getContext<T extends Encounter>(): Smart<T> | undefined;
  getPerformer<
    T extends Practitioner | PractitionerRole | Patient | RelatedPerson | Device
  >(): Smart<T>[];
  getMedicationReference(): Smart<Medication> | undefined;
}

/**
 * Reference methods for MedicationDispense resources
 */
export interface MedicationDispenseReferenceMethods {
  getSubject<T extends Patient | Group>(): Smart<T> | undefined;
  getContext<T extends Encounter>(): Smart<T> | undefined;
  getPerformer<
    T extends Practitioner | PractitionerRole | Organization | Patient | Device | RelatedPerson
  >(): Smart<T>[];
  getMedicationReference(): Smart<Medication> | undefined;
}

/**
 * Reference methods for MedicationStatement resources
 */
export interface MedicationStatementReferenceMethods {
  getSubject<T extends Patient | Group>(): Smart<T> | undefined;
  getContext<T extends Encounter>(): Smart<T> | undefined;
  getInformationSource<
    T extends Patient | Practitioner | PractitionerRole | RelatedPerson | Organization
  >(): Smart<T> | undefined;
  getMedicationReference(): Smart<Medication> | undefined;
}

/**
 * Reference methods for RelatedPerson resources
 */
export interface RelatedPersonReferenceMethods {
  getPatient(): Smart<Patient> | undefined;
}

/**
 * Reference methods for RiskAssessment resources
 */
export interface RiskAssessmentReferenceMethods {
  getSubject<T extends Patient | Group>(): Smart<T> | undefined;
  getEncounter(): Smart<Encounter> | undefined;
  getPerformer<T extends Practitioner | PractitionerRole | Device>(): Smart<T> | undefined;
}

/**
 * Reference methods for ServiceRequest resources
 */
export interface ServiceRequestReferenceMethods {
  getSubject<T extends Patient | Group | Location | Device>(): Smart<T> | undefined;
  getEncounter(): Smart<Encounter> | undefined;
  getRequester<
    T extends Practitioner | PractitionerRole | Organization | Patient | RelatedPerson | Device
  >(): Smart<T> | undefined;
  getPerformer<
    T extends
      | Practitioner
      | PractitionerRole
      | Organization
      | CareTeam
      | Patient
      | Device
      | RelatedPerson
  >(): Smart<T>[];
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
  : T extends AllergyIntolerance
  ? AllergyIntoleranceReferenceMethods
  : T extends Condition
  ? ConditionReferenceMethods
  : T extends Organization
  ? OrganizationReferenceMethods
  : T extends Location
  ? LocationReferenceMethods
  : T extends Composition
  ? CompositionReferenceMethods
  : T extends Coverage
  ? CoverageReferenceMethods
  : T extends DocumentReference
  ? DocumentReferenceReferenceMethods
  : T extends Immunization
  ? ImmunizationReferenceMethods
  : T extends Medication
  ? MedicationReferenceMethods
  : T extends MedicationRequest
  ? MedicationRequestReferenceMethods
  : T extends Procedure
  ? ProcedureReferenceMethods
  : T extends FamilyMemberHistory
  ? FamilyMemberHistoryReferenceMethods
  : T extends MedicationAdministration
  ? MedicationAdministrationReferenceMethods
  : T extends MedicationDispense
  ? MedicationDispenseReferenceMethods
  : T extends MedicationStatement
  ? MedicationStatementReferenceMethods
  : T extends RelatedPerson
  ? RelatedPersonReferenceMethods
  : T extends RiskAssessment
  ? RiskAssessmentReferenceMethods
  : T extends ServiceRequest
  ? ServiceRequestReferenceMethods
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
  AllergyIntolerance: {
    getPatient: "patient",
    getEncounter: "encounter",
    getRecorder: "recorder",
    getAsserter: "asserter",
  },
  Condition: {
    getSubject: "subject",
    getEncounter: "encounter",
    getRecorder: "recorder",
    getAsserter: "asserter",
  },
  Organization: {
    getPartOf: "partOf",
  },
  Location: {
    getManagingOrganization: "managingOrganization",
    getPartOf: "partOf",
  },
  Composition: {
    getSubject: "subject",
    getEncounter: "encounter",
    getAuthor: "author",
    getCustodian: "custodian",
  },
  Coverage: {
    getBeneficiary: "beneficiary",
    getSubscriber: "subscriber",
    getPayor: "payor",
    getPolicyHolder: "policyHolder",
  },
  DocumentReference: {
    getSubject: "subject",
    getAuthor: "author",
    getAuthenticator: "authenticator",
    getCustodian: "custodian",
  },
  Immunization: {
    getPatient: "patient",
    getEncounter: "encounter",
    getPerformer: "performer.actor",
  },
  Medication: {
    getManufacturer: "manufacturer",
  },
  MedicationRequest: {
    getSubject: "subject",
    getEncounter: "encounter",
    getRequester: "requester",
    getPerformer: "performer",
    getMedicationReference: "medicationReference",
  },
  Procedure: {
    getSubject: "subject",
    getEncounter: "encounter",
    getPerformer: "performer.actor",
  },
  FamilyMemberHistory: {
    getPatient: "patient",
  },
  MedicationAdministration: {
    getSubject: "subject",
    getContext: "context",
    getPerformer: "performer",
    getMedicationReference: "medicationReference",
  },
  MedicationDispense: {
    getSubject: "subject",
    getContext: "context",
    getPerformer: "performer",
    getMedicationReference: "medicationReference",
  },
  MedicationStatement: {
    getSubject: "subject",
    getContext: "context",
    getInformationSource: "informationSource",
    getMedicationReference: "medicationReference",
  },
  RelatedPerson: {
    getPatient: "patient",
  },
  RiskAssessment: {
    getSubject: "subject",
    getEncounter: "encounter",
    getPerformer: "performer",
  },
  ServiceRequest: {
    getSubject: "subject",
    getEncounter: "encounter",
    getRequester: "requester",
    getPerformer: "performer",
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

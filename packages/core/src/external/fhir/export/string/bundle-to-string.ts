import {
  AllergyIntolerance,
  Bundle,
  Communication,
  Composition,
  Condition,
  Consent,
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
  Resource,
} from "@medplum/fhirtypes";
import { FHIRResourceToString } from "./fhir-resource-to-string";
import { AllergyIntoleranceToString } from "./resources/allergy-intolerance";
import { CommunicationToString } from "./resources/communication";
import { CompositionToString } from "./resources/composition";
import { ConditionToString } from "./resources/condition";
import { ConsentToString } from "./resources/consent";
import { CoverageToString } from "./resources/coverage";
import { DiagnosticReportToString } from "./resources/diagnostic-report";
import { DocumentReferenceToString } from "./resources/document-reference";
import { EncounterToString } from "./resources/encounter";
import { FamilyMemberHistoryToString } from "./resources/family-member-history";
import { ImmunizationToString } from "./resources/immunization";
import { LocationToString } from "./resources/location";
import { MedicationToString } from "./resources/medication";
import { MedicationAdministrationToString } from "./resources/medication-administration";
import { MedicationDispenseToString } from "./resources/medication-dispense";
import { MedicationRequestToString } from "./resources/medication-request";
import { MedicationStatementToString } from "./resources/medication-statement";
import { ObservationToString } from "./resources/observation";
import { OrganizationToString } from "./resources/organization";
import { PatientToString } from "./resources/patient";
import { PractitionerToString } from "./resources/practitioner";
import { ProcedureToString } from "./resources/procedure";
import { RelatedPersonToString } from "./resources/related-person";

const resourceTypesToSkip: string[] = ["Patient", "Binary"];

type ResourceTypeMap = {
  AllergyIntolerance: AllergyIntolerance;
  Condition: Condition;
  Consent: Consent;
  Composition: Composition;
  Communication: Communication;
  Coverage: Coverage;
  DiagnosticReport: DiagnosticReport;
  DocumentReference: DocumentReference;
  Encounter: Encounter;
  FamilyMemberHistory: FamilyMemberHistory;
  Immunization: Immunization;
  Location: Location;
  Medication: Medication;
  MedicationAdministration: MedicationAdministration;
  MedicationDispense: MedicationDispense;
  MedicationRequest: MedicationRequest;
  MedicationStatement: MedicationStatement;
  Observation: Observation;
  Organization: Organization;
  Practitioner: Practitioner;
  Procedure: Procedure;
  RelatedPerson: RelatedPerson;
  // TODO REMOVE THIS
  Patient: Patient;
};

type ResourceType = keyof ResourceTypeMap;

/**
 * Maps FHIR resource types to their corresponding string converters
 */
const resourceToStringMap: Record<
  ResourceType,
  FHIRResourceToString<ResourceTypeMap[ResourceType]>
> = {
  AllergyIntolerance: new AllergyIntoleranceToString(),
  Condition: new ConditionToString(),
  Consent: new ConsentToString(),
  Composition: new CompositionToString(),
  Communication: new CommunicationToString(),
  Coverage: new CoverageToString(),
  DocumentReference: new DocumentReferenceToString(),
  DiagnosticReport: new DiagnosticReportToString(),
  Encounter: new EncounterToString(),
  FamilyMemberHistory: new FamilyMemberHistoryToString(),
  Immunization: new ImmunizationToString(),
  Location: new LocationToString(),
  Medication: new MedicationToString(),
  MedicationAdministration: new MedicationAdministrationToString(),
  MedicationDispense: new MedicationDispenseToString(),
  MedicationRequest: new MedicationRequestToString(),
  MedicationStatement: new MedicationStatementToString(),
  Observation: new ObservationToString(),
  Organization: new OrganizationToString(),
  Practitioner: new PractitionerToString(),
  Procedure: new ProcedureToString(),
  RelatedPerson: new RelatedPersonToString(),
  Patient: new PatientToString(),
} as const;

export type FhirResourceToText = {
  id: string;
  type: Resource["resourceType"];
  text: string;
};

/**
 * Converts a FHIR Bundle to a list of string representations of its resources.
 * Focused on searching, so not a complete representation of the FHIR resources.
 * Skips unsupported resources - @see isSupportedResource
 *
 * @param bundle - FHIR Bundle to convert
 * @param isDebug - Whether to include debug information in the output
 * @returns List of string representations of the resources in the bundle
 */
export function bundleToString(bundle: Bundle, isDebug = false): FhirResourceToText[] {
  if (!bundle.entry?.length) return [];

  const resp = bundle.entry.flatMap(entry => {
    const resource = entry.resource;
    if (!resource || !resource.id) return [];
    const text = resourceToString(resource, isDebug);
    if (!text) return [];
    return {
      id: resource.id,
      type: resource.resourceType,
      text,
    };
  });
  return resp;
}

export function resourceToString(resource: Resource, isDebug?: boolean): string | undefined {
  if (!isSupportedResource(resource)) return undefined;
  const converter = resourceToStringMap[resource.resourceType as ResourceType];
  if (!converter) return undefined;
  const text = converter.toString(resource, isDebug);
  if (!text) return undefined;
  return text;
}

function isSupportedResource(resource: Resource): resource is ResourceTypeMap[ResourceType] {
  if (resourceTypesToSkip.includes(resource.resourceType)) return false;
  return resource.resourceType in resourceToStringMap;
}

import {
  AllergyIntolerance,
  Bundle,
  Condition,
  DiagnosticReport,
  Encounter,
  Immunization,
  Medication,
  MedicationDispense,
  MedicationRequest,
  MedicationStatement,
  Observation,
  Organization,
  Patient,
  Practitioner,
  Procedure,
  Resource,
} from "@medplum/fhirtypes";
import { AllergyIntoleranceToString } from "./resources/allergy-intolerance";
import { ConditionToString } from "./resources/condition";
import { DiagnosticReportToString } from "./resources/diagnostic-report";
import { EncounterToString } from "./resources/encounter";
import { ImmunizationToString } from "./resources/immunization";
import { MedicationToString } from "./resources/medication";
import { MedicationDispenseToString } from "./resources/medication-dispense";
import { MedicationRequestToString } from "./resources/medication-request";
import { MedicationStatementToString } from "./resources/medication-statement";
import { ObservationToString } from "./resources/observation";
import { OrganizationToString } from "./resources/organization";
import { PatientToString } from "./resources/patient";
import { PractitionerToString } from "./resources/practitioner";
import { ProcedureToString } from "./resources/procedure";
import { FHIRResourceToString } from "./types";

const resourceTypesToSkip = ["Patient", "Organization", "Practitioner"];

type ResourceTypeMap = {
  AllergyIntolerance: AllergyIntolerance;
  Condition: Condition;
  DiagnosticReport: DiagnosticReport;
  Encounter: Encounter;
  Immunization: Immunization;
  Medication: Medication;
  MedicationDispense: MedicationDispense;
  MedicationRequest: MedicationRequest;
  MedicationStatement: MedicationStatement;
  Observation: Observation;
  Organization: Organization;
  Patient: Patient;
  Practitioner: Practitioner;
  Procedure: Procedure;
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
  DiagnosticReport: new DiagnosticReportToString(),
  Encounter: new EncounterToString(),
  Immunization: new ImmunizationToString(),
  Medication: new MedicationToString(),
  MedicationDispense: new MedicationDispenseToString(),
  MedicationRequest: new MedicationRequestToString(),
  MedicationStatement: new MedicationStatementToString(),
  Observation: new ObservationToString(),
  Organization: new OrganizationToString(),
  Patient: new PatientToString(),
  Practitioner: new PractitionerToString(),
  Procedure: new ProcedureToString(),
} as const;

export type TransformedResource = {
  resourceType: Resource["resourceType"];
  id: string;
  text: string;
};

/**
 * Converts a FHIR Bundle to a list of string representations of its resources
 * @param bundle - FHIR Bundle to convert
 * @returns List of string representations of the resources in the bundle
 */
export function bundleToString(bundle: Bundle): TransformedResource[] {
  if (!bundle.entry?.length) return [];

  return bundle.entry.flatMap(entry => {
    const resource = entry.resource;
    if (!resource || !resource.id || !isSupportedResource(resource)) return [];
    const converter = resourceToStringMap[resource.resourceType as ResourceType];
    if (!converter) return [];
    const text = converter.toString(resource);
    if (!text) return [];
    return {
      resourceType: resource.resourceType,
      id: resource.id,
      text,
    };
  });
}

function isSupportedResource(resource: Resource): resource is ResourceTypeMap[ResourceType] {
  if (resourceTypesToSkip.includes(resource.resourceType)) return false;
  return resource.resourceType in resourceToStringMap;
}

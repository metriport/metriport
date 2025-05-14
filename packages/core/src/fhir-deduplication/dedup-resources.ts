import {
  AllergyIntolerance,
  Composition,
  Condition,
  DiagnosticReport,
  Encounter,
  FamilyMemberHistory,
  Immunization,
  Location,
  Medication,
  MedicationAdministration,
  MedicationRequest,
  MedicationStatement,
  Observation,
  Organization,
  Practitioner,
  Procedure,
  RelatedPerson,
  Resource,
} from "@medplum/fhirtypes";
import { BadRequestError } from "@metriport/shared";
import { z } from "zod";
import { deduplicateAllergyIntolerances } from "./resources/allergy-intolerance";
import { deduplicateCompositions } from "./resources/composition";
import { deduplicateConditions } from "./resources/condition";
import { deduplicateDiagReports } from "./resources/diagnostic-report";
import { deduplicateEncounters } from "./resources/encounter";
import { deduplicateFamilyMemberHistories } from "./resources/family-member-history";
import { deduplicateImmunizations } from "./resources/immunization";
import { deduplicateLocations } from "./resources/location";
import { deduplicateMedications } from "./resources/medication";
import { deduplicateMedAdmins } from "./resources/medication-administration";
import { deduplicateMedRequests } from "./resources/medication-request";
import { deduplicateMedStatements } from "./resources/medication-statement";
import { deduplicateObservations } from "./resources/observation";
import { deduplicateOrganizations } from "./resources/organization";
import { deduplicatePractitioners } from "./resources/practitioner";
import { deduplicateProcedures } from "./resources/procedure";
import { deduplicateRelatedPersons } from "./resources/related-person";

/**
 * Deduplicates resources of the same resource type.
 *
 * Important! The input resources must all be of the same resource type and have no overlapping IDs.
 *
 * @param resources - The resources to deduplicate.
 * @param schema - The schema to parse the returned Resource objects to the input type. Optional, defaults to casting the Resource type to the input type.
 * @returns The deduplicated resources list.
 */
export function deduplicateResources<T extends Resource>({
  resources,
  schema,
}: {
  resources: T[];
  schema?: z.ZodSchema<T> | undefined;
}): T[] {
  if (resources.length < 1) return [];
  const resourceTypes: Set<string> = new Set([...resources.map(r => r.resourceType)]);
  if (resourceTypes.size > 1) {
    throw new BadRequestError("Invalid target resource types", undefined, {
      targetResourceTypes: Array.from(resourceTypes).join(","),
    });
  }
  const resourceType = resourceTypes.values().next().value;
  let deduplicatedResources: Resource[];
  switch (resourceType) {
    case "AllergyIntolerance":
      deduplicatedResources = deduplicateAllergyIntolerances(
        resources as AllergyIntolerance[]
      ).combinedResources;
      break;
    case "Composition":
      deduplicatedResources = deduplicateCompositions(resources as Composition[]).combinedResources;
      break;
    case "Condition":
      deduplicatedResources = deduplicateConditions(resources as Condition[]).combinedResources;
      break;
    case "Encounter":
      deduplicatedResources = deduplicateEncounters(resources as Encounter[]).combinedResources;
      break;
    case "DiagnosticReport":
      deduplicatedResources = deduplicateDiagReports(
        resources as DiagnosticReport[]
      ).combinedResources;
      break;
    case "FamilyMemberHistory":
      deduplicatedResources = deduplicateFamilyMemberHistories(
        resources as FamilyMemberHistory[]
      ).combinedResources;
      break;
    case "Immunization":
      deduplicatedResources = deduplicateImmunizations(
        resources as Immunization[]
      ).combinedResources;
      break;
    case "Location":
      deduplicatedResources = deduplicateLocations(resources as Location[]).combinedResources;
      break;
    case "Medication":
      deduplicatedResources = deduplicateMedications(resources as Medication[]).combinedResources;
      break;
    case "MedicationAdministration":
      deduplicatedResources = deduplicateMedAdmins(
        resources as MedicationAdministration[]
      ).combinedResources;
      break;
    case "MedicationRequest":
      deduplicatedResources = deduplicateMedRequests(
        resources as MedicationRequest[]
      ).combinedResources;
      break;
    case "MedicationStatement":
      deduplicatedResources = deduplicateMedStatements(
        resources as MedicationStatement[]
      ).combinedResources;
      break;
    case "Observation":
      deduplicatedResources = deduplicateObservations(resources as Observation[]).combinedResources;
      break;
    case "Organization":
      deduplicatedResources = deduplicateOrganizations(
        resources as Organization[]
      ).combinedResources;
      break;
    case "Practitioner":
      deduplicatedResources = deduplicatePractitioners(
        resources as Practitioner[]
      ).combinedResources;
      break;
    case "Procedure":
      deduplicatedResources = deduplicateProcedures(resources as Procedure[]).combinedResources;
      break;
    case "RelatedPerson":
      deduplicatedResources = deduplicateRelatedPersons(
        resources as RelatedPerson[]
      ).combinedResources;
      break;
    default:
      throw new BadRequestError(`Unsupported resource type: ${resourceType}`, undefined, {
        resourceType,
      });
  }
  if (schema) return deduplicatedResources.map(r => schema.parse(r));
  return deduplicatedResources as T[];
}

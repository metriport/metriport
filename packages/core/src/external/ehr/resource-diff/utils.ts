import {
  AllergyIntolerance,
  Composition,
  Condition,
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
import { MetriportError } from "@metriport/shared";
import { deduplicateAllergyIntolerances } from "../../../fhir-deduplication/resources/allergy-intolerance";
import { deduplicateCompositions } from "../../../fhir-deduplication/resources/composition";
import { deduplicateConditions } from "../../../fhir-deduplication/resources/condition";
import { deduplicateEncounters } from "../../../fhir-deduplication/resources/encounter";
import { deduplicateFamilyMemberHistories } from "../../../fhir-deduplication/resources/family-member-history";
import { deduplicateImmunizations } from "../../../fhir-deduplication/resources/immunization";
import { deduplicateLocations } from "../../../fhir-deduplication/resources/location";
import { deduplicateMedications } from "../../../fhir-deduplication/resources/medication";
import { deduplicateMedAdmins } from "../../../fhir-deduplication/resources/medication-administration";
import { deduplicateMedRequests } from "../../../fhir-deduplication/resources/medication-request";
import { deduplicateMedStatements } from "../../../fhir-deduplication/resources/medication-statement";
import { deduplicateObservations } from "../../../fhir-deduplication/resources/observation";
import { deduplicateOrganizations } from "../../../fhir-deduplication/resources/organization";
import { deduplicatePractitioners } from "../../../fhir-deduplication/resources/practitioner";
import { deduplicateProcedures } from "../../../fhir-deduplication/resources/procedure";
import { deduplicateRelatedPersons } from "../../../fhir-deduplication/resources/related-person";
import { ResourceWithId } from "./compute/ehr-compute-resource-diff";

export function computeResourceDiff({
  existingResources,
  newResource,
}: {
  existingResources: ResourceWithId[];
  newResource: ResourceWithId;
}): string[] {
  const resourceType = newResource.resourceType;
  const resourceAlreadyExists = existingResources.find(resource => resource.id === newResource.id);
  if (resourceAlreadyExists) return [];
  const resources = existingResources.concat([newResource]);
  let deduplicatedResourceInitial: Resource[];
  let deduplicatedResources: Resource[];
  switch (resourceType) {
    case "AllergyIntolerance":
      deduplicatedResourceInitial = deduplicateAllergyIntolerances(
        existingResources as AllergyIntolerance[]
      ).combinedResources;
      deduplicatedResources = deduplicateAllergyIntolerances(
        resources as AllergyIntolerance[]
      ).combinedResources;
      break;
    case "Composition":
      deduplicatedResourceInitial = deduplicateCompositions(
        existingResources as Composition[]
      ).combinedResources;
      deduplicatedResources = deduplicateCompositions(resources as Composition[]).combinedResources;
      break;
    case "Condition":
      deduplicatedResourceInitial = deduplicateConditions(
        existingResources as Condition[]
      ).combinedResources;
      deduplicatedResources = deduplicateConditions(resources as Condition[]).combinedResources;
      break;
    case "Encounter":
      deduplicatedResourceInitial = deduplicateEncounters(
        existingResources as Encounter[]
      ).combinedResources;
      deduplicatedResources = deduplicateEncounters(resources as Encounter[]).combinedResources;
      break;
    case "FamilyMemberHistory":
      deduplicatedResourceInitial = deduplicateFamilyMemberHistories(
        existingResources as FamilyMemberHistory[]
      ).combinedResources;
      deduplicatedResources = deduplicateFamilyMemberHistories(
        resources as FamilyMemberHistory[]
      ).combinedResources;
      break;
    case "Immunization":
      deduplicatedResourceInitial = deduplicateImmunizations(
        existingResources as Immunization[]
      ).combinedResources;
      deduplicatedResources = deduplicateImmunizations(
        resources as Immunization[]
      ).combinedResources;
      break;
    case "Location":
      deduplicatedResourceInitial = deduplicateLocations(
        existingResources as Location[]
      ).combinedResources;
      deduplicatedResources = deduplicateLocations(resources as Location[]).combinedResources;
      break;
    case "Medication":
      deduplicatedResourceInitial = deduplicateMedications(
        existingResources as Medication[]
      ).combinedResources;
      deduplicatedResources = deduplicateMedications(resources as Medication[]).combinedResources;
      break;
    case "MedicationAdministration":
      deduplicatedResourceInitial = deduplicateMedAdmins(
        existingResources as MedicationAdministration[]
      ).combinedResources;
      deduplicatedResources = deduplicateMedAdmins(
        resources as MedicationAdministration[]
      ).combinedResources;
      break;
    case "MedicationRequest":
      deduplicatedResourceInitial = deduplicateMedRequests(
        existingResources as MedicationRequest[]
      ).combinedResources;
      deduplicatedResources = deduplicateMedRequests(
        resources as MedicationRequest[]
      ).combinedResources;
      break;
    case "MedicationStatement":
      deduplicatedResourceInitial = deduplicateMedStatements(
        existingResources as MedicationStatement[]
      ).combinedResources;
      deduplicatedResources = deduplicateMedStatements(
        resources as MedicationStatement[]
      ).combinedResources;
      break;
    case "Observation":
      deduplicatedResourceInitial = deduplicateObservations(
        existingResources as Observation[]
      ).combinedResources;
      deduplicatedResources = deduplicateObservations(resources as Observation[]).combinedResources;
      break;
    case "Organization":
      deduplicatedResourceInitial = deduplicateOrganizations(
        existingResources as Organization[]
      ).combinedResources;
      deduplicatedResources = deduplicateOrganizations(
        resources as Organization[]
      ).combinedResources;
      break;
    case "Practitioner":
      deduplicatedResourceInitial = deduplicatePractitioners(
        existingResources as Practitioner[]
      ).combinedResources;
      deduplicatedResources = deduplicatePractitioners(
        resources as Practitioner[]
      ).combinedResources;
      break;
    case "Procedure":
      deduplicatedResourceInitial = deduplicateProcedures(
        existingResources as Procedure[]
      ).combinedResources;
      deduplicatedResources = deduplicateProcedures(resources as Procedure[]).combinedResources;
      break;
    case "RelatedPerson":
      deduplicatedResourceInitial = deduplicateRelatedPersons(
        existingResources as RelatedPerson[]
      ).combinedResources;
      deduplicatedResources = deduplicateRelatedPersons(
        resources as RelatedPerson[]
      ).combinedResources;
      break;
    default:
      throw new MetriportError(`Unsupported resource type: ${resourceType}`, undefined, {
        resourceType,
      });
  }
  if (deduplicatedResources.length > deduplicatedResourceInitial.length) return [];
  return existingResources.map(resource => resource.id);
}

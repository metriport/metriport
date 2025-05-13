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
import { artifactRelatedArtifactUrl } from "./shared";

/**
 * Computes the XOR of two lists of resources.
 * @param targetResources - The target resources.
 * @param sourceResources - The source resources.
 * @returns The XOR of the target and source resources.
 */
export function computeResourcesXorAlongResourceType({
  targetResources,
  sourceResources,
}: {
  targetResources: Resource[];
  sourceResources: Resource[];
}): {
  computedXorTargetResources: Resource[];
  computedXorSourceResources: Resource[];
} {
  if (targetResources.length < 1) {
    return { computedXorTargetResources: [], computedXorSourceResources: sourceResources };
  }
  if (sourceResources.length < 1) {
    return { computedXorTargetResources: targetResources, computedXorSourceResources: [] };
  }
  const targetResourceIds: string[] = [];
  const targetResourceTypes: Set<string> = new Set();
  const targetResourcesNoDerivedFromExtension: Resource[] = [];
  for (const resource of targetResources) {
    if (resource.id) targetResourceIds.push(resource.id);
    targetResourceTypes.add(resource.resourceType);
    targetResourcesNoDerivedFromExtension.push(removeDerivedFromExtension(resource));
  }
  if (targetResourceTypes.size > 1) {
    throw new BadRequestError("Invalid target resource types", undefined, {
      targetResourceTypes: Array.from(targetResourceTypes).join(","),
    });
  }
  const sourceResourceIds: string[] = [];
  const sourceResourceTypes: Set<string> = new Set();
  const sourceResourcesNoDerivedFromExtension: Resource[] = [];
  for (const resource of sourceResources) {
    if (resource.id) sourceResourceIds.push(resource.id);
    sourceResourceTypes.add(resource.resourceType);
    sourceResourcesNoDerivedFromExtension.push(removeDerivedFromExtension(resource));
  }
  if (sourceResourceTypes.size > 1) {
    throw new BadRequestError("Invalid source resource types", undefined, {
      sourceResourceTypes: Array.from(sourceResourceTypes).join(","),
    });
  }
  const targetResourceType = targetResourceTypes.values().next().value;
  const sourceResourceType = sourceResourceTypes.values().next().value;
  if (targetResourceType !== sourceResourceType) {
    throw new BadRequestError("Target and source resource types must match", undefined, {
      targetResourceType,
      sourceResourceType,
    });
  }
  const resources = targetResourcesNoDerivedFromExtension.concat(
    sourceResourcesNoDerivedFromExtension
  );
  let deduplicatedResources: Resource[];
  switch (targetResourceType) {
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
      throw new BadRequestError(`Unsupported resource type: ${targetResourceType}`, undefined, {
        resourceType: targetResourceType,
      });
  }
  const computedXorTargetResources: Resource[] = [];
  const computedXorSourceResources: Resource[] = [];
  for (const resource of deduplicatedResources) {
    if (!resource.id || isResourceDerived(resource)) continue;
    if (targetResourceIds.includes(resource.id)) {
      computedXorTargetResources.push(resource);
    } else if (sourceResourceIds.includes(resource.id)) {
      computedXorSourceResources.push(resource);
    }
  }
  return { computedXorTargetResources, computedXorSourceResources };
}

function removeDerivedFromExtension(resource: Resource): Resource {
  if (!("extension" in resource) || !resource.extension) return resource;
  const newExtensions = resource.extension.filter(
    extension => extension.url !== artifactRelatedArtifactUrl
  );
  return { ...resource, extension: newExtensions };
}

function isResourceDerived(resource: Resource): boolean {
  if (!("extension" in resource)) return false;
  const derivedFrom = resource.extension.find(
    extension => extension.url === artifactRelatedArtifactUrl
  );
  return derivedFrom !== undefined;
}

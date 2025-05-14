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
import { artifactRelatedArtifactUrl } from "./shared";

/**
 * Computes the XOR of two lists of resources of the same resource type.
 *
 * Important! The input resources must all be of the same resource type and have no overlapping IDs.
 *
 * @param targetResources - The target resources.
 * @param sourceResources - The source resources.
 * @param schema - The schema to parse the returned Resource objects to the input type. Optional, defaults to casting the Resource type to the input type.
 * @returns The XOR of the target and source resources. Only resources with IDs are returned.
 */
export function computeResourcesXorAlongResourceType<T extends Resource>({
  targetResources,
  sourceResources,
  schema,
}: {
  targetResources: T[];
  sourceResources: T[];
  schema?: z.ZodSchema<T>;
}): {
  computedXorTargetResources: T[];
  computedXorSourceResources: T[];
} {
  if (targetResources.length < 1) {
    return { computedXorTargetResources: [], computedXorSourceResources: sourceResources };
  }
  if (sourceResources.length < 1) {
    return { computedXorTargetResources: targetResources, computedXorSourceResources: [] };
  }
  const targetResourceIds: Set<string> = new Set();
  const targetResourceTypes: Set<string> = new Set();
  const targetResourcesNoDerivedFromExtension: Resource[] = [];
  for (const resource of targetResources) {
    if (resource.id) targetResourceIds.add(resource.id);
    targetResourceTypes.add(resource.resourceType);
    targetResourcesNoDerivedFromExtension.push(removeDerivedFromExtension(resource));
  }
  if (targetResourceTypes.size > 1) {
    throw new BadRequestError("Invalid target resource types", undefined, {
      targetResourceTypes: Array.from(targetResourceTypes).join(","),
    });
  }
  const sourceResourceIds: Set<string> = new Set();
  const sourceResourceTypes: Set<string> = new Set();
  const sourceResourcesNoDerivedFromExtension: Resource[] = [];
  for (const resource of sourceResources) {
    const resourceId = resource.id;
    if (resourceId) {
      if (targetResourceIds.has(resourceId)) {
        throw new BadRequestError(
          "Source and target resources must have no overlapping IDs",
          undefined,
          {
            idIntersection: resourceId,
          }
        );
      }
      sourceResourceIds.add(resourceId);
    }
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
  const computedXorTargetResources: T[] = [];
  const computedXorSourceResources: T[] = [];
  for (const resource of deduplicatedResources) {
    if (!resource.id || isResourceDerived(resource)) continue;
    if (targetResourceIds.has(resource.id)) {
      computedXorTargetResources.push(schema ? schema.parse(resource) : (resource as T));
    } else if (sourceResourceIds.has(resource.id)) {
      computedXorSourceResources.push(schema ? schema.parse(resource) : (resource as T));
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

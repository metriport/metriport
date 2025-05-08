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
import { FhirResource } from "@metriport/shared/interface/external/ehr/fhir-resource";
import { deduplicateAllergyIntolerances } from "../../../../../fhir-deduplication/resources/allergy-intolerance";
import { deduplicateCompositions } from "../../../../../fhir-deduplication/resources/composition";
import { deduplicateConditions } from "../../../../../fhir-deduplication/resources/condition";
import { deduplicateDiagReports } from "../../../../../fhir-deduplication/resources/diagnostic-report";
import { deduplicateEncounters } from "../../../../../fhir-deduplication/resources/encounter";
import { deduplicateFamilyMemberHistories } from "../../../../../fhir-deduplication/resources/family-member-history";
import { deduplicateImmunizations } from "../../../../../fhir-deduplication/resources/immunization";
import { deduplicateLocations } from "../../../../../fhir-deduplication/resources/location";
import { deduplicateMedications } from "../../../../../fhir-deduplication/resources/medication";
import { deduplicateMedAdmins } from "../../../../../fhir-deduplication/resources/medication-administration";
import { deduplicateMedRequests } from "../../../../../fhir-deduplication/resources/medication-request";
import { deduplicateMedStatements } from "../../../../../fhir-deduplication/resources/medication-statement";
import { deduplicateObservations } from "../../../../../fhir-deduplication/resources/observation";
import { deduplicateOrganizations } from "../../../../../fhir-deduplication/resources/organization";
import { deduplicatePractitioners } from "../../../../../fhir-deduplication/resources/practitioner";
import { deduplicateProcedures } from "../../../../../fhir-deduplication/resources/procedure";
import { deduplicateRelatedPersons } from "../../../../../fhir-deduplication/resources/related-person";
import { artifactRelatedArtifactUrl } from "../../../../../fhir-deduplication/shared";

export function computeNewResources({
  ehrResources,
  metriportResources,
}: {
  ehrResources: FhirResource[];
  metriportResources: FhirResource[];
}): {
  newEhrResources: FhirResource[];
  newMetriportResources: FhirResource[];
} {
  if (ehrResources.length < 1) {
    return { newEhrResources: [], newMetriportResources: metriportResources };
  }
  if (metriportResources.length < 1) {
    return { newEhrResources: ehrResources, newMetriportResources: [] };
  }
  const ehrResourceTypes = new Set(ehrResources.map(resource => resource.resourceType));
  if (ehrResourceTypes.size > 1) {
    throw new BadRequestError("Invalid ehr resource types", undefined, {
      ehrResourceTypes: Array.from(ehrResourceTypes).join(","),
    });
  }
  const metriportResourceTypes = new Set(metriportResources.map(resource => resource.resourceType));
  if (metriportResourceTypes.size > 1) {
    throw new BadRequestError("Invalid metriport resource types", undefined, {
      metriportResourceTypes: Array.from(metriportResourceTypes).join(","),
    });
  }
  const ehrResourceType = Array.from(ehrResourceTypes).pop();
  const metriportResourceType = Array.from(metriportResourceTypes).pop();
  if (ehrResourceType !== metriportResourceType) {
    throw new BadRequestError("Ehr and metriport resource types must match", undefined, {
      ehrResourceType,
      metriportResourceType,
    });
  }
  const ehrResourcesNoDerivedFromExtension = ehrResources.map(resource =>
    removeDerivedFromExtension(resource as Resource)
  );
  const metriportResourcesNoDerivedFromExtension = metriportResources.map(resource =>
    removeDerivedFromExtension(resource as Resource)
  );
  const resources = ehrResourcesNoDerivedFromExtension.concat(
    metriportResourcesNoDerivedFromExtension
  );
  let deduplicatedResources: Resource[];
  switch (ehrResourceType) {
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
      throw new BadRequestError(`Unsupported resource type: ${ehrResourceType}`, undefined, {
        resourceType: ehrResourceType,
      });
  }
  const ehrResourceIds = ehrResources.map(resource => resource.id);
  const metriportResourceIds = metriportResources.map(resource => resource.id);
  const newEhrResources: FhirResource[] = [];
  const newMetriportResources: FhirResource[] = [];
  for (const resource of deduplicatedResources) {
    if (!resource.id) continue;
    if (ehrResourceIds.includes(resource.id) && !resourceIsDerived(resource)) {
      newEhrResources.push(resource as FhirResource);
    } else if (metriportResourceIds.includes(resource.id) && !resourceIsDerived(resource)) {
      newMetriportResources.push(resource as FhirResource);
    }
  }
  return {
    newEhrResources: newEhrResources as FhirResource[],
    newMetriportResources: newMetriportResources as FhirResource[],
  };
}

function resourceIsDerived(resource: Resource): boolean {
  if (!("extension" in resource)) return false;
  const derivedFrom = resource.extension.find(
    extension => extension.url === artifactRelatedArtifactUrl
  );
  return derivedFrom !== undefined;
}

function removeDerivedFromExtension(resource: Resource): FhirResource {
  if (!("extension" in resource) || !resource.extension) return resource as FhirResource;
  const newExtensions = resource.extension.filter(
    extension => extension.url !== artifactRelatedArtifactUrl
  );
  return { ...resource, extension: newExtensions } as FhirResource;
}

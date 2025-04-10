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
import { BadRequestError, EhrSource, EhrSources } from "@metriport/shared";
import { FhirResource } from "@metriport/shared/interface/external/ehr/fhir-resource";
import { deduplicateAllergyIntolerances } from "../../../fhir-deduplication/resources/allergy-intolerance";
import { deduplicateCompositions } from "../../../fhir-deduplication/resources/composition";
import { deduplicateConditions } from "../../../fhir-deduplication/resources/condition";
import { deduplicateDiagReports } from "../../../fhir-deduplication/resources/diagnostic-report";
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
import { artifactRelatedArtifactUrl } from "../../../fhir-deduplication/shared";
import { supportedCanvasDiffResources } from "../canvas";

export function computeResourceDiff({
  existingResources,
  newResource,
}: {
  existingResources: FhirResource[];
  newResource: FhirResource;
}): string[] {
  const newResourceType = newResource.resourceType;
  const invalidExistingResources = existingResources.filter(
    resource => resource.resourceType !== newResourceType
  );
  if (invalidExistingResources.length > 0) {
    throw new BadRequestError("Invalid existing resource types", undefined, {
      invalidExistingResourceIds: invalidExistingResources.map(resource => resource.id).join(","),
      invalidExistingResourceTypes: invalidExistingResources
        .map(resource => resource.resourceType)
        .join(","),
    });
  }
  const newResourceAlreadyExists = existingResources.find(
    resource => resource.id === newResource.id
  );
  if (newResourceAlreadyExists) return [];

  const resources = existingResources.concat([newResource]);
  let deduplicatedResources: Resource[];
  switch (newResourceType) {
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
      throw new BadRequestError(`Unsupported resource type: ${newResourceType}`, undefined, {
        resourceType: newResourceType,
      });
  }

  const existingResourceIds = existingResources.map(resource => resource.id);
  const newResourceInDeduplicatedResources = deduplicatedResources.find(
    resource => resource.id === newResource.id
  );
  if (!newResourceInDeduplicatedResources) return existingResourceIds;
  const newResourceIsDerivedFromExistingResource = resourceIsDerivedFromExistingResource(
    newResourceInDeduplicatedResources
  );
  if (newResourceIsDerivedFromExistingResource) return existingResourceIds;
  return [];
}

function resourceIsDerivedFromExistingResource(resource: Resource): boolean {
  if (!("extension" in resource)) return false;
  const derivedFrom = resource.extension.find(
    extension => extension.url === artifactRelatedArtifactUrl
  );
  return derivedFrom !== undefined;
}

export function getSupportedResources(ehr: EhrSource) {
  if (ehr === EhrSources.canvas) return supportedCanvasDiffResources;
  return [];
}

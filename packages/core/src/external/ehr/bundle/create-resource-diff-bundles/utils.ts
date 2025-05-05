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
import { deduplicateAllergyIntolerances } from "../../../../fhir-deduplication/resources/allergy-intolerance";
import { deduplicateCompositions } from "../../../../fhir-deduplication/resources/composition";
import { deduplicateConditions } from "../../../../fhir-deduplication/resources/condition";
import { deduplicateDiagReports } from "../../../../fhir-deduplication/resources/diagnostic-report";
import { deduplicateEncounters } from "../../../../fhir-deduplication/resources/encounter";
import { deduplicateFamilyMemberHistories } from "../../../../fhir-deduplication/resources/family-member-history";
import { deduplicateImmunizations } from "../../../../fhir-deduplication/resources/immunization";
import { deduplicateLocations } from "../../../../fhir-deduplication/resources/location";
import { deduplicateMedications } from "../../../../fhir-deduplication/resources/medication";
import { deduplicateMedAdmins } from "../../../../fhir-deduplication/resources/medication-administration";
import { deduplicateMedRequests } from "../../../../fhir-deduplication/resources/medication-request";
import { deduplicateMedStatements } from "../../../../fhir-deduplication/resources/medication-statement";
import { deduplicateObservations } from "../../../../fhir-deduplication/resources/observation";
import { deduplicateOrganizations } from "../../../../fhir-deduplication/resources/organization";
import { deduplicatePractitioners } from "../../../../fhir-deduplication/resources/practitioner";
import { deduplicateProcedures } from "../../../../fhir-deduplication/resources/procedure";
import { deduplicateRelatedPersons } from "../../../../fhir-deduplication/resources/related-person";
import { artifactRelatedArtifactUrl } from "../../../../fhir-deduplication/shared";

export function computeNewResources({
  existingResources,
  testResources,
}: {
  existingResources: FhirResource[];
  testResources: FhirResource[];
}): FhirResource[] {
  if (testResources.length < 1) return [];
  if (existingResources.length < 1) return testResources;
  const testResourceTypes = new Set(testResources.map(resource => resource.resourceType));
  if (testResourceTypes.size > 1) {
    throw new BadRequestError("Invalid test resource types", undefined, {
      testResourceTypes: Array.from(testResourceTypes).join(","),
    });
  }
  const existingResourceTypes = new Set(existingResources.map(resource => resource.resourceType));
  if (existingResourceTypes.size > 1) {
    throw new BadRequestError("Invalid existing resource types", undefined, {
      existingResourceTypes: Array.from(existingResourceTypes).join(","),
    });
  }
  const testResourceType = Array.from(testResourceTypes).pop();
  const existingResourceType = Array.from(existingResourceTypes).pop();
  if (testResourceType !== existingResourceType) {
    throw new BadRequestError("Test and existing resource types must match", undefined, {
      testResourceType,
      existingResourceType,
    });
  }
  const testResourcesNoDerivedFromExtension = testResources.map(resource =>
    removeDerivedFromExtension(resource as Resource)
  );
  const existingResourcesNoDerivedFromExtension = existingResources.map(resource =>
    removeDerivedFromExtension(resource as Resource)
  );
  const resources = existingResourcesNoDerivedFromExtension.concat(
    testResourcesNoDerivedFromExtension
  );
  let deduplicatedResources: Resource[];
  switch (testResourceType) {
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
      throw new BadRequestError(`Unsupported resource type: ${testResourceType}`, undefined, {
        resourceType: testResourceType,
      });
  }
  const testResourceIds = testResources.map(resource => resource.id);
  const newResources = deduplicatedResources.filter(resource => {
    if (!resource.id) return false;
    return testResourceIds.includes(resource.id) && !resourceIsDerived(resource);
  });
  return newResources as FhirResource[];
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

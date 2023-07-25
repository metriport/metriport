import { OperationOutcomeError } from "@medplum/core";
import {
  Bundle,
  BundleEntry,
  ExtractResource,
  OperationOutcomeIssue,
  Resource,
  ResourceType,
} from "@medplum/fhirtypes";
import { intersection } from "lodash";
import { makeFhirApi } from "../../../external/fhir/api/api-factory";
import {
  isoDateRangeToFHIRDateQuery,
  resourceSupportsDateQuery,
} from "../../../external/fhir/shared";
import { capture } from "../../../shared/notifications";
import { Util } from "../../../shared/util";
import { getPatientOrFail } from "./get-patient";

function fullDateQueryForResource(fullDateQuery: string, resource: ResourceType): string {
  return resourceSupportsDateQuery(resource) ? fullDateQuery : "";
}

export async function getConsolidatedPatientData({
  cxId,
  patientId,
  resources,
  dateFrom,
  dateTo,
}: {
  cxId: string;
  patientId: string;
  resources?: ResourceTypeForConsolidation[];
  dateFrom?: string;
  dateTo?: string;
}): Promise<Bundle<Resource>> {
  const { log } = Util.out(`[getConsolidatedPatientData - cxId ${cxId}, patientId ${patientId}]`);

  // Just validate that the patient exists
  await getPatientOrFail({ id: patientId, cxId });

  const resourcesByPatient = resources
    ? intersection(resources, resourcesSearchableByPatient)
    : resourcesSearchableByPatient;
  const resourcesBySubject = resources
    ? intersection(resources, resourcesSearchableBySubject)
    : resourcesSearchableBySubject;
  log(`Getting consolidated data with resources by patient: ${resourcesByPatient.join(", ")}...`);
  log(`...and by subject: ${resourcesBySubject.join(", ")}`);

  const fhir = makeFhirApi(cxId);
  const errorsToReport: Record<string, string> = {};
  const searchResources = async <K extends ResourceType>(
    resource: K,
    searchFunction: () => AsyncGenerator<ExtractResource<K>[]>
  ) => {
    try {
      const pages: Resource[] = [];
      for await (const page of searchFunction()) {
        pages.push(...page);
      }
      return pages;
      //eslint-disable-next-line @typescript-eslint/no-explicit-any
    } catch (err: any) {
      if (err instanceof OperationOutcomeError && err.outcome.id === "not-found") throw err;
      if (err instanceof OperationOutcomeError) errorsToReport[resource] = getMessage(err);
      else errorsToReport[resource] = err.message;
      throw err;
    }
  };
  const fhirDateQuery = isoDateRangeToFHIRDateQuery(dateFrom, dateTo);
  const fullDateQuery = fhirDateQuery ? `&${fhirDateQuery}` : "";
  const settled = await Promise.allSettled([
    ...resourcesByPatient.map(async resource =>
      searchResources(resource, () =>
        fhir.searchResourcePages(
          resource,
          `patient=${patientId}${fullDateQueryForResource(fullDateQuery, resource)}`
        )
      )
    ),
    ...resourcesBySubject.map(async resource =>
      searchResources(resource, () =>
        fhir.searchResourcePages(
          resource,
          `subject=${patientId}${fullDateQueryForResource(fullDateQuery, resource)}`
        )
      )
    ),
  ]);

  const success: Resource[] = settled.flatMap(s => (s.status === "fulfilled" ? s.value : []));

  if (Object.keys(errorsToReport).length > 0) {
    log(
      `Failed to get some resources (${success.length} succeeded): ${JSON.stringify(
        errorsToReport
      )}`
    );
    capture.error(new Error(`Failed to get some resources for patient`), {
      extra: {
        context: `getConsolidatedPatientData`,
        patientId,
        errorsToReport,
        succeeded: success.length,
      },
    });
  }

  const entry: BundleEntry[] = success.map(r => ({ resource: r }));
  return buildResponse(entry);
}

function buildResponse(entries: BundleEntry[]): Bundle<Resource> {
  return { resourceType: "Bundle", total: entries.length, type: "searchset", entry: entries };
}

function getMessage(err: OperationOutcomeError): string {
  return err.outcome.issue ? err.outcome.issue.map(issueToString).join(",") : "";
}

function issueToString(issue: OperationOutcomeIssue): string {
  return (
    issue.details?.text ??
    (issue.diagnostics ? issue.diagnostics.slice(0, 100) + "..." : null) ??
    JSON.stringify(issue)
  );
}

export const resourcesSearchableByPatient = [
  "Account",
  "AllergyIntolerance",
  "Appointment",
  "AppointmentResponse",
  "AuditEvent",
  "Basic",
  "BodyStructure",
  "CarePlan",
  "CareTeam",
  "ChargeItem",
  "Claim",
  "ClaimResponse",
  "ClinicalImpression",
  "Communication",
  "CommunicationRequest",
  "Composition",
  "Condition",
  "Consent",
  "Contract",
  "Coverage",
  "CoverageEligibilityRequest",
  "CoverageEligibilityResponse",
  "DetectedIssue",
  "Device",
  "DeviceRequest",
  "DeviceUseStatement",
  "DiagnosticReport",
  "DocumentManifest",
  "DocumentReference",
  "Encounter",
  "EnrollmentRequest",
  "EpisodeOfCare",
  "ExplanationOfBenefit",
  "FamilyMemberHistory",
  "Flag",
  "Goal",
  "GuidanceResponse",
  "ImagingStudy",
  "Immunization",
  "ImmunizationEvaluation",
  "ImmunizationRecommendation",
  "Invoice",
  "List",
  "MeasureReport",
  "Media",
  "MedicationAdministration",
  "MedicationDispense",
  "MedicationRequest",
  "MedicationStatement",
  "MolecularSequence",
  "NutritionOrder",
  "Observation",
  "Person",
  "Procedure",
  "Provenance",
  "QuestionnaireResponse",
  "RelatedPerson",
  "RequestGroup",
  "ResearchSubject",
  "RiskAssessment",
  "ServiceRequest",
  "Specimen",
] as const;

export const resourcesSearchableBySubject = ["AdverseEvent", "Task"] as const;

export const resourceTypeForConsolidation = [
  ...resourcesSearchableByPatient,
  ...resourcesSearchableBySubject,
] as const;

export type ResourceTypeForConsolidation = (typeof resourceTypeForConsolidation)[number];

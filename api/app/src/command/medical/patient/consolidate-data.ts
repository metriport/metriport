import { OperationOutcomeError } from "@medplum/core";
import { Bundle, BundleEntry, OperationOutcomeIssue, Resource } from "@medplum/fhirtypes";
import { makeFhirApi } from "../../../external/fhir/api/api-factory";
import { capture } from "../../../shared/notifications";
import { Util } from "../../../shared/util";
import { getPatientOrFail } from "./get-patient";

export async function getConsolidatedPatientData({
  cxId,
  patientId,
  resources,
}: {
  cxId: string;
  patientId: string;
  resources?: ResourceTypeForConsolidation[];
}): Promise<Bundle<Resource>> {
  const { log } = Util.out(`[getConsolidatedPatientData - cxId ${cxId}, patientId ${patientId}]`);
  const fhir = makeFhirApi(cxId);

  // Just validate that the patient exists
  await getPatientOrFail({ id: patientId, cxId });

  const resourcesToUse = resources ?? resourceTypeForConsolidation;
  log(`Getting consolidated data with resources: `, resourcesToUse);

  const errorsToReport: Record<string, string> = {};
  const settled = await Promise.allSettled(
    resourcesToUse.map(async resource =>
      fhir.search(resource, `patient=${patientId}`).catch(err => {
        if (err instanceof OperationOutcomeError && err.outcome.id === "not-found") throw err;
        if (err instanceof OperationOutcomeError) errorsToReport[resource] = getMessage(err);
        else errorsToReport[resource] = err.message;
        throw err;
      })
    )
  );

  const success: BundleEntry[] = settled.flatMap(s =>
    s.status === "fulfilled" && s.value.entry ? s.value.entry : []
  );
  const successCount = success.length;

  if (Object.keys(errorsToReport).length > 0) {
    log(
      `Failed to get some resources for patient ${patientId} (${successCount} succeeded): ${JSON.stringify(
        errorsToReport
      )}`
    );
    capture.error(new Error(`Failed to get some resources for patient`), {
      extra: {
        context: `getConsolidatedPatientData`,
        patientId,
        errorsToReport,
        succeeded: successCount,
      },
    });
  }

  return { resourceType: "Bundle", total: successCount, type: "searchset", entry: success };
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

export const resourceTypeForConsolidation = [
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

export type ResourceTypeForConsolidation = (typeof resourceTypeForConsolidation)[number];

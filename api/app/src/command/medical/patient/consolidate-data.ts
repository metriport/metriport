import { OperationOutcomeError } from "@medplum/core";
import { Bundle, BundleEntry } from "@medplum/fhirtypes";
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
}): Promise<Bundle> {
  const { log } = Util.out(`[getConsolidatedPatientData - cxId ${cxId}, patientId ${patientId}]`);
  const fhir = makeFhirApi("cxId");

  // Just validate that the patient exists
  await getPatientOrFail({ id: patientId, cxId });

  const resourcesToUse = resources ?? resourceTypeForConsolidation;
  log(`Getting consolidated data with resources: `, resourcesToUse);

  const settled = await Promise.allSettled(
    resourcesToUse.map(async resource =>
      fhir.search(resource, `patient=${patientId}`).catch(err => {
        if (err instanceof OperationOutcomeError && err.outcome.id === "not-found") throw err;
        log(`Failed to get ${resource} for patient ${patientId} with error: ${err}`);
        capture.error(err, {
          extra: { context: `getConsolidatedPatientData`, resource, patientId },
        });
        throw err;
      })
    )
  );

  const success: BundleEntry[] = settled
    .flatMap(s => (s.status === "fulfilled" ? s : []))
    .map(s => s.value);

  return { resourceType: "Bundle", entry: success };
}

export const resourceTypeForConsolidation = [
  "AllergyIntolerance",
  "CarePlan",
  "Claim",
  "Condition",
  "Consent",
  "Contract",
  "Coverage",
  "DetectedIssue",
  "DocumentReference",
  "EpisodeOfCare",
  "Encounter",
  "FamilyMemberHistory",
  "Invoice",
  "MeasureReport",
  "Media",
  "MedicationAdministration",
  "MedicationDispense",
  "MedicationRequest",
  "MedicationStatement",
  "Observation",
  "Procedure",
  "QuestionnaireResponse",
  "RelatedPerson",
  "RiskAssessment",
  "ServiceRequest",
] as const;

export type ResourceTypeForConsolidation = (typeof resourceTypeForConsolidation)[number];

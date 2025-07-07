import { BundleEntry, Resource } from "@medplum/fhirtypes";
import { IncomingData } from "../schema/shared";
import { ResponseDetail } from "../schema/response";
import { SurescriptsContext } from "./types";
import { getMedication } from "./medication";
import { getMedicationDispense } from "./medication-dispense";
import { getMedicationRequest } from "./medication-request";
import { getPrescriber } from "./prescriber";
import { getPharmacy } from "./pharmacy";
import { getPatient, mergePatient } from "./patient";
import { getCondition } from "./condition";
import { getInsuranceOrganization, getCoverage } from "./coverage";
import { deduplicateByCoding, deduplicateByKey, deduplicateBySystemIdentifier } from "./shared";

export function getAllBundleEntries(
  context: SurescriptsContext,
  { data }: IncomingData<ResponseDetail>
): BundleEntry<Resource>[] {
  const patient = mergePatient(context.patient, getPatient(data));
  const practitioner = deduplicateBySystemIdentifier(context.practitioner, getPrescriber(data));
  const pharmacy = deduplicateBySystemIdentifier(context.pharmacy, getPharmacy(data));
  const condition = deduplicateByCoding(context.condition, getCondition(context, data));
  const medicationResources = getMedicationResources(context, data);
  const coverageResources = getCoverageResources(context, data);

  return [
    patient,
    practitioner,
    pharmacy,
    condition,
    ...medicationResources,
    ...coverageResources,
  ].flatMap(resource => {
    if (!resource) return [];
    return [
      {
        fullUrl: `urn:uuid:${resource.id}`,
        resource,
      },
    ];
  });
}

function getMedicationResources(
  context: SurescriptsContext,
  data: ResponseDetail
): (Resource | undefined)[] {
  // const medication = deduplicateByCoding(context.medication, getMedication(data));
  const medication = getMedication(data);
  if (!medication) return [];
  const medicationDispense = getMedicationDispense(context, medication, data);
  const medicationRequest = getMedicationRequest(context, medication, data);
  return [medication, medicationDispense, medicationRequest];
}

function getCoverageResources(context: SurescriptsContext, data: ResponseDetail): Resource[] {
  const insuranceOrganization = deduplicateBySystemIdentifier(
    context.insuranceOrganization,
    getInsuranceOrganization(data)
  );
  if (!insuranceOrganization) return [];
  const coverage = deduplicateByKey(
    context.coverage,
    "subscriberId",
    getCoverage(context, insuranceOrganization, data)
  );
  if (!coverage) return [];
  return [insuranceOrganization, coverage];
}

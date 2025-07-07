import { BundleEntry, Resource, Practitioner, Organization, Patient } from "@medplum/fhirtypes";
import { IncomingData } from "../schema/shared";
import { ResponseDetail } from "../schema/response";
import { getMedication } from "./medication";
import { getMedicationDispense } from "./medication-dispense";
import { getMedicationRequest } from "./medication-request";
import { getPrescriber } from "./prescriber";
import { getPharmacy } from "./pharmacy";
import { getPatient } from "./patient";
import { getCondition } from "./condition";
import { getInsuranceOrganization, getCoverage } from "./coverage";

export function getAllBundleEntries({
  data,
}: IncomingData<ResponseDetail>): BundleEntry<Resource>[] {
  const patient = getPatient(data);
  const prescriber = getPrescriber(data);
  const pharmacy = getPharmacy(data);
  const condition = getCondition(patient, data);
  const medicationResources = getMedicationResources({
    prescriber,
    pharmacy,
    patient,
    detail: data,
  });
  const coverageResources = getCoverageResources(patient, data);

  return [
    patient,
    prescriber,
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

function getMedicationResources({
  prescriber,
  pharmacy,
  patient,
  detail,
}: {
  prescriber?: Practitioner | undefined;
  pharmacy?: Organization | undefined;
  patient: Patient;
  detail: ResponseDetail;
}): (Resource | undefined)[] {
  const medication = getMedication(detail);
  if (!medication) return [];
  const medicationRequest = getMedicationRequest({ prescriber, medication, detail });
  const medicationDispense = getMedicationDispense({
    pharmacy,
    medicationRequest,
    medication,
    detail,
    patient,
  });

  return [medication, medicationDispense, medicationRequest];
}

function getCoverageResources(patient: Patient, data: ResponseDetail): Resource[] {
  const insuranceOrganization = getInsuranceOrganization(data);
  if (!insuranceOrganization) return [];
  const coverage = getCoverage(patient, insuranceOrganization, data);
  if (!coverage) return [];
  return [insuranceOrganization, coverage];
}

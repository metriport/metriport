import { BundleEntry, Resource } from "@medplum/fhirtypes";
import { ResponseDetail } from "../schema/response";
import { SurescriptsConverterContext } from "./types";
import { getMedication } from "./medication";
import { getMedicationDispense } from "./medication-dispense";
import { getMedicationRequest } from "./medication-request";
import { getPrescriber } from "./prescriber";
import { getPharmacy } from "./pharmacy";
import { getPatient } from "./patient";
import { getCondition } from "./condition";
import { getResourceFromSystemIdentifierMap } from "./shared";

export function convertPatientDetailToEntries(
  context: SurescriptsConverterContext,
  detail: ResponseDetail
): BundleEntry<Resource>[] {
  const patient = context.patient ?? getPatient(detail);
  const practitioner = getResourceFromSystemIdentifierMap(
    context.practitioner,
    getPrescriber(detail)
  );
  const pharmacy = getResourceFromSystemIdentifierMap(context.pharmacy, getPharmacy(detail));
  const condition = getCondition(detail);
  const medication = getMedication(detail);
  const medicationDispense = getMedicationDispense(detail);
  const medicationRequest = getMedicationRequest(detail);

  return [
    patient,
    practitioner,
    pharmacy,
    condition,
    medication,
    medicationDispense,
    medicationRequest,
  ].flatMap(function (resource): BundleEntry<Resource>[] {
    if (!resource) return [];
    return [{ resource }];
  });
}

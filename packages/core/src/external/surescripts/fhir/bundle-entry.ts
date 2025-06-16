import { BundleEntry, Resource } from "@medplum/fhirtypes";
import { IncomingData } from "../schema/shared";
import { ResponseDetail } from "../schema/response";
import { SurescriptsContext } from "./types";
import { getMedication } from "./medication";
import { getMedicationDispense } from "./medication-dispense";
import { getMedicationRequest } from "./medication-request";
import { getPrescriber } from "./prescriber";
import { getPharmacy } from "./pharmacy";
import { getPatient } from "./patient";
import { getCondition } from "./condition";
import { deduplicateBySystemIdentifier } from "./shared";

export function getAllBundleEntries(
  context: SurescriptsContext,
  { data }: IncomingData<ResponseDetail>
): BundleEntry<Resource>[] {
  const patient = context.patient ?? getPatient(data);
  const practitioner = deduplicateBySystemIdentifier(context.practitioner, getPrescriber(data));
  const pharmacy = deduplicateBySystemIdentifier(context.pharmacy, getPharmacy(data));
  const condition = getCondition(data);
  const medication = getMedication(data);
  const medicationDispense = getMedicationDispense(context, data);
  const medicationRequest = getMedicationRequest(context, data);

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

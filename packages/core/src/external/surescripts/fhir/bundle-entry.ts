import { BundleEntry, Resource } from "@medplum/fhirtypes";
import { uuidv7 } from "@metriport/shared/util/uuid-v7";
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
import { deduplicateByCoding, deduplicateBySystemIdentifier } from "./shared";

export function getAllBundleEntries(
  context: SurescriptsContext,
  { data }: IncomingData<ResponseDetail>
): BundleEntry<Resource>[] {
  const patient = mergePatient(context.patient, getPatient(data));
  const practitioner = deduplicateBySystemIdentifier(context.practitioner, getPrescriber(data));
  const pharmacy = deduplicateBySystemIdentifier(context.pharmacy, getPharmacy(data));
  const medication = deduplicateByCoding(context.medication, getMedication(data));
  const condition = deduplicateByCoding(context.condition, getCondition(context, data));
  const medicationDispense = medication
    ? getMedicationDispense(context, medication, data)
    : undefined;
  const medicationRequest = medication
    ? getMedicationRequest(context, medication, data)
    : undefined;

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
    if (!resource.id) resource.id = uuidv7();
    return [
      {
        fullUrl: `urn:uuid:${resource.id}`,
        resource,
      },
    ];
  });
}

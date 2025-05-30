import { FlatFileDetail } from "./schema/response";

import { parseMedication } from "./fhir/medication";
import { parseMedicationDispense } from "./fhir/medication-dispense";
import { parseMedicationRequest } from "./fhir/medication-request";
import { parsePractitioner } from "./fhir/practitioner";
import { parsePharmacy } from "./fhir/pharmacy";
import { parsePatient } from "./fhir/patient";

export async function parseFlatFileDetail(detail: FlatFileDetail) {
  const patient = parsePatient(detail);
  const medication = await parseMedication(detail);
  const medicationDispense = parseMedicationDispense(detail);
  const medicationRequest = await parseMedicationRequest(detail);
  const practitioner = parsePractitioner(detail);
  const pharmacy = parsePharmacy(detail);

  return {
    patient,
    medication,
    medicationDispense,
    medicationRequest,
    practitioner,
    pharmacy,
  };
}

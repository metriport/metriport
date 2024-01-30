import { MetriportError } from "@metriport/core/util/error/metriport-error";
import { Patient } from "@metriport/core/domain/patient";

export function processFhirAndSearchResponse(
  patient: Pick<Patient, "id">,
  docId: string,
  fhir: PromiseSettledResult<void>
): void {
  const base = { patientId: patient.id, docId: docId };
  if (fhir.status === "rejected") {
    throw new MetriportError("Error upserting to FHIR", undefined, {
      ...base,
      failed: fhir.reason,
    });
  }
}

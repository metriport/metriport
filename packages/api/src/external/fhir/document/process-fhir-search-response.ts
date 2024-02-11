import { MetriportError } from "@metriport/core/util/error/metriport-error";
import { Patient } from "@metriport/core/domain/patient";

export function processFhirResponse(
  patient: Pick<Patient, "id">,
  docId: string,
  fhir: PromiseSettledResult<void>
): void {
  if (fhir.status === "rejected") {
    throw new MetriportError("Error upserting to FHIR", undefined, {
      patientId: patient.id,
      docId: docId,
      failed: fhir.reason,
    });
  }
}

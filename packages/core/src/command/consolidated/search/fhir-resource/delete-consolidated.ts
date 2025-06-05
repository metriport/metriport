import { Patient } from "../../../../domain/patient";
import { OpenSearchFhirIngestor } from "../../../../external/opensearch/fhir-ingestor";
import { getConfigs } from "./fhir-config";

/**
 * Delete a patient's consolidated resources from OpenSearch.
 *
 * @param patient The patient to delete.
 */
export async function deletePatientConsolidated(
  patient: Pick<Patient, "cxId" | "id">
): Promise<void> {
  const { cxId, id: patientId } = patient;
  const ingestor = new OpenSearchFhirIngestor(getConfigs());
  await ingestor.delete({ cxId, patientId });
}

import { buildDayjs } from "@metriport/shared/common/date";
import { Patient } from "../../../../domain/patient";
import { OpenSearchFhirSearcher } from "../../../../external/opensearch/lexical/lexical-searcher";
import { Config } from "../../../../util/config";
import { getConfigs } from "./fhir-config";
import { IngestConsolidatedDirect } from "./ingest-consolidated-direct";

const consolidatedDataIngestionInitialDate = Config.getConsolidatedDataIngestionInitialDate();

/**
 * Ingests consolidated data if needed and applicable to the patient.
 *
 * Patients created after a certain date don't need this as their data is automatically
 * ingested as part of the data pipeline.
 *
 * To decide whether to ingest, we just hit OS to see if there's any data for the patient.
 * If there's no data, we ingest (direct implementation, not via SQS+Lambda as would be
 * usual).
 *
 * @param patient The patient to ingest consolidated data for.
 */
export async function ingestIfNeeded(patient: Patient): Promise<void> {
  if (
    !consolidatedDataIngestionInitialDate ||
    buildDayjs(patient.createdAt).isAfter(buildDayjs(consolidatedDataIngestionInitialDate))
  ) {
    return;
  }

  const { cxId, id: patientId } = patient;

  const searchService = new OpenSearchFhirSearcher(getConfigs());
  const isIngested = await searchService.hasData({ cxId, patientId });

  if (!isIngested) {
    const ingestor = new IngestConsolidatedDirect();
    await ingestor.ingestConsolidatedIntoSearchEngine({ cxId, patientId });
  }
}

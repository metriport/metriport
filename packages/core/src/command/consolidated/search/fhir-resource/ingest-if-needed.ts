import { buildDayjs } from "@metriport/shared/common/date";
import { sleep } from "@metriport/shared/common/sleep";
import { Features } from "../../../../domain/features";
import { Patient } from "../../../../domain/patient";
import { CloudWatchUtils, Metrics } from "../../../../external/aws/cloudwatch";
import { OpenSearchConsolidatedSearcher } from "../../../../external/opensearch/lexical/fhir-searcher";
import { Config } from "../../../../util/config";
import { getConfigs } from "./fhir-config";
import { IngestConsolidatedDirect } from "./ingest-consolidated-direct";

const WAIT_AFTER_INGESTION_IN_MILLIS = 1_000;
const consolidatedDataIngestionInitialDate = Config.getConsolidatedDataIngestionInitialDate();

const cloudWatchUtils = new CloudWatchUtils(
  Config.getAWSRegion(),
  Features.ConsolidatedIngestIfNeeded
);

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
  const metrics: Metrics = {};
  const startedAt = Date.now();

  const { cxId, id: patientId } = patient;

  let localStartedAt = Date.now();
  const searchService = new OpenSearchConsolidatedSearcher(getConfigs());
  const isIngested = await searchService.hasData({ cxId, patientId });
  let elapsedTime = Date.now() - localStartedAt;
  metrics.ingestIfNeeded_checkHasData = { duration: elapsedTime, timestamp: new Date() };

  if (!isIngested) {
    localStartedAt = Date.now();
    const ingestor = new IngestConsolidatedDirect();
    await ingestor.ingestConsolidatedIntoSearchEngine({ cxId, patientId });
    elapsedTime = Date.now() - localStartedAt;
    metrics.ingestIfNeeded_ingest = { duration: elapsedTime, timestamp: new Date() };

    await sleep(WAIT_AFTER_INGESTION_IN_MILLIS);
  }

  metrics.ingestIfNeeded_total = { duration: Date.now() - startedAt, timestamp: new Date() };
  await cloudWatchUtils.reportMetrics(metrics);
}

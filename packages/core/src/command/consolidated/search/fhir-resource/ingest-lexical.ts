import { Features } from "../../../../domain/features";
import { Patient } from "../../../../domain/patient";
import { CloudWatchUtils, Metrics, withMetrics } from "../../../../external/aws/cloudwatch";
import { OpenSearchFhirIngestor } from "../../../../external/opensearch/fhir-ingestor";
import { OnBulkItemError } from "../../../../external/opensearch/shared/bulk";
import { capture, out } from "../../../../util";
import { Config } from "../../../../util/config";
import { getConsolidatedPatientData } from "../../consolidated-get";
import { getConfigs } from "./fhir-config";

const cloudWatchUtils = new CloudWatchUtils(Config.getAWSRegion(), Features.ConsolidatedIngestion);

/**
 * Ingest a patient's consolidated resources into OpenSearch for lexical search.
 *
 * @param patient The patient to ingest.
 */
export async function ingestPatientConsolidated({
  patient,
  onItemError,
}: {
  patient: Patient;
  onItemError?: OnBulkItemError;
}) {
  const { cxId, id: patientId } = patient;
  const { log } = out(`ingestPatientConsolidated - cx ${cxId}, pt ${patientId}`);
  const metrics: Metrics = {};
  const startedAt = Date.now();

  const ingestor = new OpenSearchFhirIngestor(getConfigs());

  log("Getting consolidated and cleaning up the index...");
  const localStartedAt = Date.now();
  const [bundle] = await Promise.all([
    withMetrics(
      () => getConsolidatedPatientData({ patient }),
      "ingest_getConsolidated",
      metrics,
      log
    ),
    withMetrics(() => ingestor.delete({ cxId, patientId }), "ingest_deleteIngested", metrics, log),
  ]);
  metrics.ingest_preIngest = { duration: Date.now() - localStartedAt, timestamp: new Date() };

  const resources =
    bundle.entry?.flatMap(entry => {
      const resource = entry.resource;
      if (!resource) return [];
      if (resource.resourceType === "Patient") return [];
      return resource;
    }) ?? [];

  log("Done, calling ingestBulk...");
  const errors = await withMetrics(
    () => ingestor.ingestBulk({ cxId, patientId, resources, onItemError }),
    "ingest_ingestBulk",
    metrics
  );

  const elapsedTime = Date.now() - startedAt;
  metrics.ingest_total = { duration: elapsedTime, timestamp: new Date() };
  await cloudWatchUtils.reportMetrics(metrics);

  if (errors.size > 0) captureErrors({ cxId: patient.cxId, patientId: patient.id, errors, log });

  log(`Ingested ${resources.length} resources in ${elapsedTime} ms`);
}

function captureErrors({
  cxId,
  patientId,
  errors,
  log,
}: {
  cxId: string;
  patientId: string;
  errors: Map<string, number>;
  log: typeof console.log;
}) {
  const errorMapToObj = Object.fromEntries(errors.entries());
  log(`Errors: `, () => JSON.stringify(errorMapToObj));
  capture.error("Errors ingesting resources into OpenSearch", {
    extra: { cxId, patientId, countPerErrorType: JSON.stringify(errorMapToObj, null, 2) },
  });
}

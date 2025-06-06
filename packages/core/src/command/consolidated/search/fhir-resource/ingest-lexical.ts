import { Bundle, Resource } from "@medplum/fhirtypes";
import { MetriportError } from "@metriport/shared";
import { Features } from "../../../../domain/features";
import { Patient } from "../../../../domain/patient";
import { CloudWatchUtils, Metrics, withMetrics } from "../../../../external/aws/cloudwatch";
import { normalize } from "../../../../external/fhir/consolidated/normalize";
import { OpenSearchFhirIngestor } from "../../../../external/opensearch/fhir-ingestor";
import { OnBulkItemError } from "../../../../external/opensearch/shared/bulk";
import { out } from "../../../../util";
import { Config } from "../../../../util/config";
import { getConsolidatedFile } from "../../consolidated-get";
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
}): Promise<void> {
  const { cxId, id: patientId } = patient;
  const { log } = out(`ingestPatientConsolidated - cx ${cxId}, pt ${patientId}`);
  const metrics: Metrics = {};
  const startedAt = Date.now();

  const ingestor = new OpenSearchFhirIngestor(getConfigs());

  log("Getting consolidated and cleaning up the index...");
  const localStartedAt = Date.now();
  const [bundle] = await Promise.all([
    withMetrics(
      () => getConsolidatedBundle({ cxId, patientId }),
      "ingest_getConsolidatedBundle",
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

  if (errors.size > 0) processErrors({ cxId, patientId, errors, log });

  log(`Ingested ${resources.length} resources in ${elapsedTime} ms`);
}

/**
 * Throws an error if there are errors ingesting resources into OpenSearch.
 */
function processErrors({
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
  throw new MetriportError("Errors ingesting resources into OpenSearch", {
    extra: {
      cxId,
      patientId,
      countPerErrorType: JSON.stringify(errorMapToObj),
    },
  });
}

async function getConsolidatedBundle({
  cxId,
  patientId,
}: {
  cxId: string;
  patientId: string;
}): Promise<Bundle<Resource>> {
  const { log } = out(`getConsolidatedBundle - cx ${cxId}, pt ${patientId}`);

  const consolidated = await getConsolidatedFile({ cxId, patientId });

  const bundle = consolidated.bundle;
  if (!bundle) {
    const bucket = consolidated.fileLocation;
    const key = consolidated.fileName;
    const msg = `No consolidated bundle found during ingestion in OS`;
    log(`${msg} for patient ${patientId} w/ key ${key}, skipping ingestion`);
    throw new MetriportError(msg, undefined, { cxId, patientId, key, bucket });
  }

  // TODO ENG-316 Remove this step when we implement normalization on consolidated
  const normalizedBundle = await normalize({ cxId, patientId, bundle });

  return normalizedBundle;
}

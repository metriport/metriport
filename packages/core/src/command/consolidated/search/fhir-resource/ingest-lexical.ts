import { Bundle, Resource } from "@medplum/fhirtypes";
import { MetriportError } from "@metriport/shared";
import { timed } from "@metriport/shared/util/duration";
import { Patient } from "../../../../domain/patient";
import { normalize } from "../../../../external/fhir/consolidated/normalize";
import { OpenSearchFhirIngestor } from "../../../../external/opensearch/fhir-ingestor";
import { OnBulkItemError } from "../../../../external/opensearch/shared/bulk";
import { capture, out } from "../../../../util";
import { getConsolidatedFile } from "../../consolidated-get";
import { getConfigs } from "./fhir-config";

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

  const ingestor = new OpenSearchFhirIngestor(getConfigs());

  log("Getting consolidated and cleaning up the index...");
  const [bundle] = await Promise.all([
    timed(
      () => getConsolidatedBundle({ cxId, patientId }),
      "getConsolidatedBundleAndNotifyWhenMissing",
      log
    ),
    ingestor.delete({ cxId, patientId }),
  ]);

  const resources =
    bundle.entry?.flatMap(entry => {
      const resource = entry.resource;
      if (!resource) return [];
      if (resource.resourceType === "Patient") return [];
      return resource;
    }) ?? [];

  log("Done, calling ingestBulk...");
  const startedAt = Date.now();
  const errors = await ingestor.ingestBulk({
    cxId,
    patientId,
    resources,
    onItemError,
  });
  const elapsedTime = Date.now() - startedAt;

  if (errors.size > 0) captureErrors({ cxId, patientId, errors, log });

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

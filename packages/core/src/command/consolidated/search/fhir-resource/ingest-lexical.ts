import { Bundle, Resource } from "@medplum/fhirtypes";
import { executeWithRetries, MetriportError } from "@metriport/shared";
import { timed } from "@metriport/shared/util/duration";
import { Patient } from "../../../../domain/patient";
import { isRetriableError } from "../../../../external/aws/s3";
import { mapEntryToResource } from "../../../../external/fhir/bundle/entry";
import { normalize } from "../../../../external/fhir/consolidated/normalize";
import { isNotPatient } from "../../../../external/fhir/shared";
import { isDerivedFromExtension } from "../../../../external/fhir/shared/extensions/derived-from";
import { OpenSearchFhirIngestor } from "../../../../external/opensearch/fhir-ingestor";
import { OnBulkItemError } from "../../../../external/opensearch/shared/bulk";
import { out } from "../../../../util";
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

  log("Getting consolidated");
  const bundle = await timed(
    () => getConsolidatedBundle({ cxId, patientId }),
    "getConsolidatedBundle",
    log
  );

  log("Cleaning up the index...");
  await ingestor.delete({ cxId, patientId });

  const entries = bundle.entry ?? [];
  const resources = entries
    .map(mapEntryToResource)
    .filter(isNotPatient)
    .flatMap(r => (r ? removeDerivedFromExtensions(r) : []));

  log("Done, calling ingestBulk...");
  const startedAt = Date.now();
  const errors = await ingestor.ingestBulk({
    cxId,
    patientId,
    resources,
    onItemError,
  });
  const elapsedTime = Date.now() - startedAt;

  if (errors.size > 0) processErrors({ cxId, patientId, errors, log });

  log(`Ingested ${resources.length} resources in ${elapsedTime} ms`);
}

/**
 * WARNING: it mutates the resource in place, removing "derived-from" extensions.
 */
export function removeDerivedFromExtensions(mutatingResource: Resource): Resource {
  if ("extension" in mutatingResource && mutatingResource.extension) {
    mutatingResource.extension = mutatingResource.extension.filter(e => !isDerivedFromExtension(e));
  }
  return mutatingResource;
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
  throw new MetriportError("Errors ingesting resources into OpenSearch", undefined, {
    cxId,
    patientId,
    countPerErrorType: JSON.stringify(errorMapToObj),
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

  const consolidated = await executeWithRetries(() => getConsolidatedFile({ cxId, patientId }), {
    shouldRetry: (res, error: unknown) => {
      if (!res?.bundle) return true;
      if (!error) return false;
      if (!isRetriableError(error)) return false;
      return true;
    },
    initialDelay: 1_000,
    maxAttempts: 10,
    backoffMultiplier: 1.6,
    log,
  });

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

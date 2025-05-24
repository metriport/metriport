import { Patient } from "../../../../domain/patient";
import { OpenSearchFhirIngestor } from "../../../../external/opensearch/fhir-ingestor";
import { OpenSearchFhirSearcher } from "../../../../external/opensearch/lexical/fhir-searcher";
import { OnBulkItemError } from "../../../../external/opensearch/shared/bulk";
import { capture, out } from "../../../../util";
import { getConsolidatedPatientData } from "../../consolidated-get";
import { getConfigs } from "./fhir-config";

/**
 * Ingest a patient's consolidated resources into OpenSearch for lexical search.
 *
 * @param patient The patient to ingest.
 */
export async function ingestLexicalFhir({
  patient,
  onItemError,
}: {
  patient: Patient;
  onItemError?: OnBulkItemError;
}) {
  const { log } = out(`ingestLexicalFhir - cx ${patient.cxId}, pt ${patient.id}`);

  const ingestor = new OpenSearchFhirIngestor({
    ...getConfigs(),
    settings: { logLevel: "info" },
  });

  const [bundle] = await Promise.all([
    getConsolidatedPatientData({ patient }),
    ingestor.delete({ cxId: patient.cxId, patientId: patient.id }),
  ]);

  const resources =
    bundle.entry?.flatMap(entry => {
      const resource = entry.resource;
      if (!resource) return [];
      if (resource.resourceType === "Patient") return [];
      return resource;
    }) ?? [];

  const startedAt = Date.now();
  const errors = await ingestor.ingestBulk({
    cxId: patient.cxId,
    patientId: patient.id,
    resources,
    onItemError,
  });
  const elapsedTime = Date.now() - startedAt;

  if (errors.size > 0) captureErrors({ cxId: patient.cxId, patientId: patient.id, errors, log });

  log(`Ingested ${resources.length} resources in ${elapsedTime} ms`);
}

/**
 * Initialize the lexical index in OpenSearch.
 */
export async function initializeFhirIndex() {
  const searchService = new OpenSearchFhirSearcher(getConfigs());
  await searchService.createIndexIfNotExists();
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

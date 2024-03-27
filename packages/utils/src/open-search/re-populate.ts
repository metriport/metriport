import * as dotenv from "dotenv";
dotenv.config();
// Keep dotenv import and config before everything else
import { DocumentReference, DocumentReferenceContent } from "@medplum/fhirtypes";
import { makeFhirAdminApi, makeFhirApi } from "@metriport/core/external/fhir/api/api-factory";
import { OpenSearchFileIngestorDirect } from "@metriport/core/external/opensearch/file-ingestor-direct";
import { isMetriportContent } from "@metriport/core/external/fhir/shared/extensions/metriport";
import { isCommonwellExtension } from "@metriport/core/external/commonwell/extension";
import { executeAsynchronously } from "@metriport/core/util/concurrency";
import { getEnvVarOrFail } from "@metriport/core/util/env-var";
import { out } from "@metriport/core/util/log";
import { Dictionary, groupBy } from "lodash";

/**
 * WARNING: this is expensive to run!
 *
 * Script to re-populate OpenSearch based on DocumentReferences from the FHIR server.
 *
 * Gets all doc refs from all customers (unless specified otherwise) and, for each, loads
 * the CCDA/XML docs from S3, cleans them up, and indexes them in OpenSearch.
 *
 * Note: for sandbox, we should use the seed data S3 bucket, not the medical documents one.
 */

// Indicate how to filter for doc refs, or leave them empty for all doc refs.
const cxIds: string[] = [];
const patientIds: string[] = [];
const docRefIds: string[] = [];

// Number of documents to ingest in parallel
const PARALLEL_INGESTION_COUNT = 15;

const region = getEnvVarOrFail("AWS_REGION");
const fhirBaseUrl = getEnvVarOrFail("FHIR_SERVER_URL");
const s3BucketName = getEnvVarOrFail("MEDICAL_DOCUMENTS_BUCKET_NAME");
const openSearchUsername = getEnvVarOrFail("SEARCH_USERNAME");
const openSearchPassword = getEnvVarOrFail("SEARCH_PASSWORD");
const openSearchHost = getEnvVarOrFail("SEARCH_ENDPOINT");
const openSearchIndexName = getEnvVarOrFail("SEARCH_INDEX");

const NO_PATIENT_ID = "na";

const filtersToApply = new URLSearchParams();
patientIds.length && filtersToApply.append("patient", patientIds.join(","));
docRefIds.length && filtersToApply.append(`_id`, docRefIds.join(","));
// minimize the amount of data to only what we need
filtersToApply.append(`_elements`, ["id", "subject", "content", "extension"].join(","));
const filters = filtersToApply.toString();

const searchService = new OpenSearchFileIngestorDirect({
  region,
  endpoint: openSearchHost,
  indexName: openSearchIndexName,
  username: openSearchUsername,
  password: openSearchPassword,
  settings: { logLevel: "none" },
});

const isSandbox = () => getEnvVarOrFail("ENV_TYPE") === "sandbox";

async function getCxIds(): Promise<string[]> {
  const fhirApi = makeFhirAdminApi(fhirBaseUrl);
  return fhirApi.listTenants();
}

async function getDocRefs(
  cxIds: string[] = []
): Promise<Dictionary<Dictionary<DocumentReference[]>>> {
  const cxIdsToProcess = cxIds.length ? cxIds : await getCxIds();
  // Doing in sequence to avoid hammering down the FHIR server
  const docRefs: Dictionary<Dictionary<DocumentReference[]>> = {};
  for (const cxId of cxIdsToProcess) {
    const cxDocRefs = await getDocRefsFromCx(cxId);
    const docRefsByPatient = groupBy(cxDocRefs, patientIdFromDocRef);
    docRefs[cxId] = docRefsByPatient;
    console.log(`Got ${cxDocRefs.length} documents for cxId: ${cxId}`);
  }
  return docRefs;
}

function patientIdFromDocRef(docRef: DocumentReference): string {
  return docRef.subject?.reference?.split("/")[1] ?? NO_PATIENT_ID;
}

async function getDocRefsFromCx(cxId: string): Promise<DocumentReference[]> {
  try {
    const fhirApi = makeFhirApi(cxId, fhirBaseUrl);
    const docs: DocumentReference[] = [];
    // TODO use getDocuments() instead - see src/external/fhir/document/get-documents.ts
    for await (const page of fhirApi.searchResourcePages("DocumentReference", filters)) {
      docs.push(...page);
    }
    const docsWithIngestibleContent = docs.filter(isIngestible);
    if (isSandbox()) return docsWithIngestibleContent;
    const docsFromCW = docsWithIngestibleContent.filter(isFromCommonWell);
    const cwDocsWithMetriportAttachment = docsFromCW.filter(hasMetriportAttachment);
    return cwDocsWithMetriportAttachment;
  } catch (error) {
    console.log(`Error getting documents from FHIR server - cxId: ${cxId}, error: `, error);
    throw error;
  }
}

function isIngestible(doc: DocumentReference): boolean {
  return (doc.content ?? []).some(content => searchService.isIngestible(toFile(content)));
}

function toFile(content: DocumentReferenceContent): { contentType?: string; fileName: string } {
  return {
    contentType: content.attachment?.contentType,
    fileName: content.attachment?.title ?? "",
  };
}

// TODO These functions are all copied from packages/api, ideally we would move them to packages/core.
function isFromCommonWell(doc: DocumentReference) {
  const extensions = doc.extension;
  if (!extensions) return false;
  const cw = extensions.find(isCommonwellExtension);
  if (!cw) return false;
  return true;
}
function hasMetriportAttachment(doc: DocumentReference) {
  return doc.content?.some(isMetriportContent) === true;
}

type DocToProcess = { cxId: string; patientId: string; docId: string; s3FileName: string };

async function main() {
  const startTimestamp = Date.now();
  console.log(`Running at ${new Date().toISOString()}, params:`);
  console.log(`- cxIds: ${cxIds.join(", ")}`);
  console.log(`- patientIds: ${patientIds.join(", ")}`);
  console.log(`- docRefIds: ${docRefIds.join(", ")}`);

  // Flatten to process them all in parallel
  const toProcess: DocToProcess[] = [];

  console.log(`Getting doc refs...`);
  const patientsAndDocRefsByCustomer = await getDocRefs(cxIds);

  console.log(`Done, processing data...`);
  const customers = Object.keys(patientsAndDocRefsByCustomer);
  for (const cxId of customers) {
    const docRefsByPatient = patientsAndDocRefsByCustomer[cxId];
    const patients = Object.keys(docRefsByPatient);

    for (const patientId of patients) {
      const docRefs = docRefsByPatient[patientId];
      if (patientId === NO_PATIENT_ID) {
        console.log(
          `Got ${docRefs.length} documents for cxId: ${cxId} with no patient ID, skipping those...`
        );
        continue;
      }

      for (const docRef of docRefs) {
        const docId = docRef.id;
        if (!docId) {
          console.log(`No doc ID found for docRef ${JSON.stringify(docRef)}`);
          continue;
        }
        const content = docRef.content?.find(isMetriportContent);
        if (!content) {
          console.log(`No Metriport content found for docRef ${docRef.id}`);
          continue;
        }
        const s3FileName = content.attachment?.title;
        if (!s3FileName) {
          console.log(`No S3 file name found for docRef ${docRef.id}`);
          continue;
        }
        toProcess.push({ cxId, patientId, docId, s3FileName });
      }
    }
  }

  console.log(`Ingesting data in OpenSearch...`);
  let totalDocCount = 0;

  const ingestOneDocument = async (
    { cxId, patientId, docId, s3FileName }: DocToProcess,
    itemIndex: number,
    promiseIndex: number,
    promiseCount: number
  ) => {
    const { log } = out(
      `promise ${leftPad(promiseIndex + 1, 2)}/${promiseCount} - item ${leftPad(itemIndex + 1, 3)}`
    );
    try {
      const payload = {
        cxId,
        patientId,
        entryId: docId,
        s3FileName,
        s3BucketName,
      };
      await searchService.ingest(payload);
      totalDocCount++;
      log(`Docs done: ${leftPad(totalDocCount, 7)}`);
      //eslint-disable-next-line @typescript-eslint/no-explicit-any
    } catch (error: any) {
      const details = error.meta
        ? `status: ${error.meta.statusCode}, response: ${
            error.meta.body?.error ? JSON.stringify(error.meta.body?.error) : undefined
          }`
        : error.message;
      log(
        `Error ingesting doc ${docId} for cxId ${cxId} and patient ${patientId}, ` +
          `file ${s3FileName}: ${details}`
      );
    }
  };

  console.log(`# of items to process: ${toProcess.length}`);
  await executeAsynchronously(toProcess, ingestOneDocument, {
    numberOfParallelExecutions: PARALLEL_INGESTION_COUNT,
    maxJitterMillis: 0,
  });

  console.log(`Done.`);
  console.log(``);
  console.log(`Ingested ${totalDocCount} documents in ${Date.now() - startTimestamp} milliseconds`);
}

function leftPad(value: number, length: number): string {
  return String(value).padStart(length, " ");
}

main();

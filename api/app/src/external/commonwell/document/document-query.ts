import { DocumentReference } from "@medplum/fhirtypes";
import {
  CommonwellError,
  Document,
  documentReferenceResourceType,
  OperationOutcome,
  operationOutcomeResourceType,
} from "@metriport/commonwell-sdk";
import { chunk, partition } from "lodash";
import { updateDocQuery } from "../../../command/medical/document/document-query";
import {
  docToFile,
  getFileInfoFromS3,
  getS3Info,
  getUrl,
  S3Info,
  uploadStream,
} from "../../../command/medical/document/document-query-storage-info";
import { ApiTypes, reportUsage } from "../../../command/usage/report-usage";
import {
  MAPIWebhookStatus,
  MAPIWebhookType,
  processPatientDocumentRequest,
} from "../../../command/webhook/medical";
import ConversionError from "../../../errors/conversion-error";
import MetriportError from "../../../errors/metriport-error";
import { Facility } from "../../../models/medical/facility";
import { Organization } from "../../../models/medical/organization";
import { Patient } from "../../../models/medical/patient";
import { toDTO } from "../../../routes/medical/dtos/documentDTO";
import { Config } from "../../../shared/config";
import { getDocumentPrimaryId } from "../../../shared/external";
import { capture } from "../../../shared/notifications";
import { oid } from "../../../shared/oid";
import { Util } from "../../../shared/util";
import { reportMetric } from "../../aws/cloudwatch";
import { convertCDAToFHIR, isConvertible } from "../../fhir-converter/converter";
import { makeFhirApi } from "../../fhir/api/api-factory";
import { MAX_FHIR_DOC_ID_LENGTH, toFHIR as toFHIRDocRef } from "../../fhir/document";
import { upsertDocumentToFHIRServer } from "../../fhir/document/save-document-reference";
import { groupFHIRErrors, tryDetermineFhirError } from "../../fhir/shared/error-mapping";
import { getAllPages } from "../../fhir/shared/paginated";
import { makeCommonWellAPI, organizationQueryMeta } from "../api";
import { groupCWErrors } from "../error-categories";
import { getPatientData, PatientDataCommonwell } from "../patient-shared";
import { downloadDocument as downloadDocumentFromCW } from "./document-download";
import { sandboxGetDocRefsAndUpsert } from "./document-query-sandbox";
import { CWDocumentWithMetriportData, getFileName } from "./shared";

const DOC_DOWNLOAD_CHUNK_SIZE = 10;

const DOC_DOWNLOAD_JITTER_DELAY_MAX_MS = 3_000; // in milliseconds
const DOC_DOWNLOAD_JITTER_DELAY_MIN_PCT = 10; // 1-100% of max delay

const DOC_DOWNLOAD_CHUNK_DELAY_MAX_MS = 10_000; // in milliseconds
const DOC_DOWNLOAD_CHUNK_DELAY_MIN_PCT = 40; // 1-100% of max delay

/**
 * This is likely to be a long-running function
 */
export async function queryAndProcessDocuments({
  patient,
  facilityId,
  override,
}: {
  patient: Patient;
  facilityId: string;
  override?: boolean;
}): Promise<number> {
  const { log } = Util.out(`CW queryDocuments - M patient ${patient.id}`);

  const { organization, facility } = await getPatientData(patient, facilityId);

  try {
    if (Config.isSandbox()) {
      const documentsSandbox = await sandboxGetDocRefsAndUpsert({
        organization,
        facility,
        patient,
      });
      return documentsSandbox.length;
    } else {
      log(`Querying for documents of patient ${patient.id}...`);
      const cwDocuments = await internalGetDocuments({ patient, organization, facility });
      log(`Got ${cwDocuments.length} documents from CW`);

      const fhirDocRefs = await downloadDocsAndUpsertFHIR({
        patient,
        organization,
        facilityId,
        documents: cwDocuments,
        override,
      });

      reportDocQueryUsage(patient);

      log(`Finished processing ${fhirDocRefs.length} documents.`);
      return fhirDocRefs.length;
    }
  } catch (err) {
    console.log(`Error: `, err);
    processPatientDocumentRequest(
      organization.cxId,
      patient.id,
      MAPIWebhookType.documentDownload,
      MAPIWebhookStatus.failed
    );
    await updateDocQuery({
      patient: { id: patient.id, cxId: patient.cxId },
      downloadProgress: { status: "failed" },
    });
    capture.error(err, {
      extra: {
        context: `cw.queryDocuments`,
        ...(err instanceof CommonwellError ? err.additionalInfo : undefined),
      },
    });
    throw err;
  }
}

export async function internalGetDocuments({
  patient,
  organization,
  facility,
}: {
  patient: Patient;
  organization: Organization;
  facility: Facility;
}): Promise<Document[]> {
  const context = "cw.queryDocument";
  const { log } = Util.out(`CW internalGetDocuments - M patient ${patient.id}`);

  const externalData = patient.data.externalData?.COMMONWELL;
  if (!externalData) {
    log(`No external data found for patient ${patient.id}, not querying for docs`);
    return [];
  }
  const cwData = externalData as PatientDataCommonwell;

  const reportDocQueryMetric = (queryStart: number) => {
    const queryDuration = Date.now() - queryStart;
    reportMetric({
      name: context,
      value: queryDuration,
      unit: "Milliseconds",
      additionalDimension: "CommonWell",
    });
  };

  const orgName = organization.data.name;
  const orgId = organization.id;
  const facilityNPI = facility.data["npi"] as string; // TODO #414 move to strong type - remove `as string`
  const commonWell = makeCommonWellAPI(orgName, oid(orgId));
  const queryMeta = organizationQueryMeta(orgName, { npi: facilityNPI });

  const docs: Document[] = [];
  const cwErrs: OperationOutcome[] = [];
  try {
    const queryStart = Date.now();
    const queryResponse = await commonWell.queryDocumentsFull(queryMeta, cwData.patientId);
    reportDocQueryMetric(queryStart);
    log(`resp queryDocumentsFull: ${JSON.stringify(queryResponse)}`);

    for (const item of queryResponse.entry) {
      if (item.content?.resourceType === documentReferenceResourceType) {
        docs.push(item as Document);
      } else if (item.content?.resourceType === operationOutcomeResourceType) {
        cwErrs.push(item as OperationOutcome);
      } else {
        log(`Unexpected resource type: ${item.content?.resourceType}`);
      }
    }
  } catch (err) {
    log(`Error querying docs: ${err}`);
    capture.error(err, {
      extra: {
        context: `cw.queryDocuments`,
        cwReference: commonWell.lastReferenceHeader,
        ...(err instanceof CommonwellError ? err.additionalInfo : undefined),
      },
    });
    throw err;
  }

  if (cwErrs.length > 0) {
    reportCWErrors({
      errors: cwErrs,
      context: {
        cwReference: commonWell.lastReferenceHeader,
        patientId: patient.id,
      },
      log,
    });
  }

  log(`Document query got ${docs.length} documents${docs.length ? ", processing" : ""}...`);
  const documents: Document[] = docs.flatMap(d => {
    if (d.content.size === 0) {
      log(`Document is of size 0, this may result in a 404 error - doc id ${d.id}`);
      capture.message("Document is of size 0", {
        extra: { document: JSON.stringify(d, null, 2) },
      });
    }

    if (d.content && d.content.masterIdentifier?.value && d.content.location) {
      return {
        id: d.content.masterIdentifier.value,
        content: { location: d.content.location, ...d.content },
        contained: d.content.contained,
        masterIdentifier: d.content.masterIdentifier,
        subject: d.content.subject,
        context: d.content.context,
        fileName: getFileName(patient, d),
        description: d.content.description,
        type: d.content.type,
        status: d.content.status,
        location: d.content.location,
        indexed: d.content.indexed,
        mimeType: d.content.mimeType,
        size: d.content.size, // bytes
      };
    }
    log(`content, master ID or location not present, skipping - ${JSON.stringify(d)}`);
    return [];
  });

  return documents;
}

function reportCWErrors({
  errors,
  context,
  log,
}: {
  errors: OperationOutcome[];
  context: Record<string, unknown>;
  log: ReturnType<typeof Util.out>["log"];
}): void {
  const errorsByCategory = groupCWErrors(errors);
  for (const [category, errors] of Object.entries(errorsByCategory)) {
    const msg = `Document query error - ${category}`;
    log(`${msg}: ${JSON.stringify(errors)}`);
    capture.error(new Error(msg), {
      extra: { ...context, errors },
    });
  }
}

function reportFHIRError({
  patientId,
  doc,
  error,
  log,
}: {
  patientId: string;
  doc: Document;
  error: unknown;
  log: ReturnType<typeof Util.out>["log"];
}) {
  const errorTitle = `CDA>FHIR ${ConversionError.prefix}`;
  const extra = {
    context: `cw.getDocuments.convertToFHIR`,
    patientId: patientId,
    documentReference: doc,
    originalError: error,
  };
  const mappingError = tryDetermineFhirError(error);
  if (mappingError.type === "mapping") {
    const mappedErrors = mappingError.errors;
    const groupedErrors = groupFHIRErrors(mappedErrors);
    for (const [group, errors] of Object.entries(groupedErrors)) {
      const msg = `${errorTitle} - ${group}`;
      log(`${msg} (docId ${doc.id}): ${msg}, errors: `, errors);
      capture.error(new ConversionError(msg, error), {
        extra: {
          ...extra,
          errors,
        },
      });
    }
  } else {
    log(`${errorTitle} (docId ${doc.id}): ${error}`);
    capture.error(new ConversionError(errorTitle, error), { extra });
  }
}

async function initPatientDocQuery(
  patient: Patient,
  totalDocs: number,
  convertibleDocs: number
): Promise<Patient> {
  return updateDocQuery({
    patient: { id: patient.id, cxId: patient.cxId },
    downloadProgress: {
      status: "processing",
      total: totalDocs,
    },
    convertProgress:
      convertibleDocs > 0
        ? {
            status: "processing",
            total: convertibleDocs,
          }
        : {
            status: "completed",
            total: 0,
          },
  });
}

type DocumentWithLocation = Document & { content: { location: string } };

// custom type guard, this is dangerous as the compiler can't tell whether we're checking or not - but either this or exclamation point
function isValidDoc(doc: Document): doc is DocumentWithLocation {
  const fhirDocId = getDocumentPrimaryId(doc);
  // Make this before download and insert on S3 bc of https://metriport.slack.com/archives/C04DBBJSKGB/p1684113732495119?thread_ts=1684105959.041439&cid=C04DBBJSKGB
  if (fhirDocId.length > MAX_FHIR_DOC_ID_LENGTH) {
    capture.message("FHIR doc ID too long", { extra: { fhirDocId, docId: doc.id } });
    return false;
  }
  const docLocation = doc.content.location;
  if (!docLocation) {
    console.log(`Doc without location, skipping - fhirDocId ${fhirDocId}, docId ${doc.id}`);
    return false;
  }
  return true;
}

function convertToNonExistingS3Info(patient: Patient): (doc: Document) => S3Info {
  return (doc: Document): S3Info => {
    const simpleFile = docToFile(patient)(doc);
    return {
      ...simpleFile,
      fileExists: false,
      fileSize: undefined,
    };
  };
}

export async function downloadDocsAndUpsertFHIR({
  patient,
  organization,
  facilityId,
  documents,
  override = false,
}: {
  patient: Patient;
  organization: Organization;
  facilityId: string;
  documents: Document[];
  override?: boolean;
}): Promise<DocumentReference[]> {
  const { log } = Util.out(`CW downloadDocsAndUpsertFHIR - M patient ${patient.id}`);
  override && log(`override=true, NOT checking whether docs exist`);

  const fhirApi = makeFhirApi(patient.cxId);
  const docsNewLocation: DocumentReference[] = [];
  let completedCount = 0;
  let errorCount = 0;
  let errorCountConvertible = 0;

  const validDocs = documents.filter(isValidDoc);
  log(`I have ${validDocs.length} valid docs to process`);

  // Get File info from S3 (or from memory, if override = true)
  const getFilesWithStorageInfo = async () =>
    override
      ? validDocs.map(convertToNonExistingS3Info(patient))
      : await getS3Info(validDocs, patient);

  // Get all DocumentReferences for this patient + File info from S3
  const [foundOnFHIR, filesWithStorageInfo] = await Promise.all([
    getAllPages(() => fhirApi.searchResourcePages("DocumentReference", `patient=${patient.id}`)),
    getFilesWithStorageInfo(),
  ]);

  const [foundOnStorage, notFoundOnStorage] = partition(
    filesWithStorageInfo,
    (f: S3Info) => f.fileExists
  );
  // Make sure the found ones are on FHIR, otherwise also download them and store on FHIR
  const foundButNotOnFHIR = foundOnStorage.filter(f => !foundOnFHIR.find(d => d.id === f.docId));
  const filesToDownload = notFoundOnStorage.concat(foundButNotOnFHIR);

  const docsToDownload = filesToDownload.flatMap(f => validDocs.find(d => d.id === f.docId) ?? []);

  const fileInfoByDocId = (docId: string) => filesWithStorageInfo.find(f => f.docId === docId);

  const convertibleDocCount = docsToDownload.filter(isConvertible).length;
  log(`I have ${docsToDownload.length} docs to download (${convertibleDocCount} convertible)`);
  await initPatientDocQuery(patient, docsToDownload.length, convertibleDocCount);

  // split the list in chunks
  const chunks = chunk(docsToDownload, DOC_DOWNLOAD_CHUNK_SIZE);
  for (const docChunk of chunks) {
    const s3Refs = await Promise.allSettled(
      docChunk.map(async doc => {
        let errorReported = false;
        const isConvertibleDoc = isConvertible(doc);
        try {
          const fileInfo = fileInfoByDocId(doc.id);
          if (!fileInfo)
            throw new MetriportError("Missing file info", undefined, { docId: doc.id });
          const fhirDocId = fileInfo.fhirDocId;

          let uploadToS3: () => Promise<{
            bucket: string;
            key: string;
            location: string;
            size: number | undefined;
            isNew: boolean;
          }>;
          let file: Awaited<ReturnType<typeof uploadToS3>>;

          try {
            // add some randomness to avoid overloading the servers
            await jitterSingleDownload();

            if (!fileInfo.fileExists) {
              // Download from CW and upload to S3
              uploadToS3 = async () => {
                const { writeStream, promise } = uploadStream(
                  fileInfo.fileName,
                  fileInfo.fileLocation,
                  doc.content.mimeType
                );
                await downloadDocumentFromCW({
                  cxId: patient.cxId,
                  patientId: patient.id,
                  facilityId: facilityId,
                  location: doc.content.location,
                  stream: writeStream,
                });
                const uploadResult = await promise;
                const { size } = await getFileInfoFromS3(uploadResult.Key, uploadResult.Bucket);
                return {
                  bucket: uploadResult.Bucket,
                  key: uploadResult.Key,
                  location: uploadResult.Location,
                  size,
                  isNew: true,
                };
              };
            } else {
              // Get info from existing S3 file
              uploadToS3 = async () => {
                const signedUrl = getUrl(fileInfo.fileName, fileInfo.fileLocation);
                const url = new URL(signedUrl);
                const s3Location = url.origin + url.pathname;
                return {
                  bucket: fileInfo.fileLocation,
                  key: fileInfo.fileName,
                  location: s3Location,
                  size: fileInfo.fileSize,
                  isNew: false,
                };
              };
            }
            file = await uploadToS3();
          } catch (error) {
            const isZeroLength = doc.content.size === 0;
            const zeroLengthDetailsStr = isZeroLength ? "zero length document" : "";
            log(
              `Error downloading ${zeroLengthDetailsStr} from CW and upserting to FHIR (docId ${doc.id}): ${error}`
            );
            capture.error(error, {
              extra: {
                context: `s3.documentUpload`,
                patientId: patient.id,
                documentReference: doc,
                isZeroLength,
              },
            });
            errorReported = true;
            throw error;
          }
          const docWithFile: CWDocumentWithMetriportData = {
            ...doc,
            metriport: {
              fileName: file.key,
              location: file.location,
              fileSize: file.size,
            },
          };

          if (file.isNew) {
            await convertCDAToFHIR({
              patient,
              document: { ...doc, id: fhirDocId },
              s3FileName: file.key,
              s3BucketName: file.bucket,
            });
          }

          const FHIRDocRef = toFHIRDocRef(fhirDocId, docWithFile, organization, patient);
          try {
            await upsertDocumentToFHIRServer(organization.cxId, FHIRDocRef);
          } catch (error) {
            reportFHIRError({ patientId: patient.id, doc, error, log });
            errorReported = true;
            throw error;
          }

          completedCount++;

          return FHIRDocRef;
        } catch (error) {
          errorCount++;
          if (isConvertibleDoc) errorCountConvertible++;

          log(`Error processing doc: ${error}`, doc);
          if (!errorReported) {
            capture.error(error, {
              extra: {
                context: `cw.downloadDocsAndUpsertFHIR`,
                patientId: patient.id,
                document: doc,
              },
            });
          }
          throw error;
        } finally {
          // TODO: eventually we will have to update this to support multiple HIEs
          try {
            await updateDocQuery({
              patient: { id: patient.id, cxId: patient.cxId },
              downloadProgress: {
                status: "processing",
                successful: completedCount,
                errors: errorCount,
              },
            });
          } catch (err) {
            capture.error(err, {
              extra: { context: `cw.downloadDocsAndUpsertFHIR`, patient },
            });
          }
        }
      })
    );

    const docGroupLocations: DocumentReference[] = s3Refs.flatMap(ref =>
      ref.status === "fulfilled" && ref.value ? ref.value : []
    );
    docsNewLocation.push(...docGroupLocations);

    // take some time to avoid throttling other servers
    await sleepBetweenChunks();
  }

  await updateDocQuery({
    patient: { id: patient.id, cxId: patient.cxId },
    downloadProgress: { status: "completed" },
    convertibleDownloadErrors: errorCountConvertible,
  });
  // send webhook to CXs when docs are done downloading
  processPatientDocumentRequest(
    organization.cxId,
    patient.id,
    MAPIWebhookType.documentDownload,
    MAPIWebhookStatus.completed,
    toDTO(docsNewLocation)
  );

  return docsNewLocation;
}

async function sleepBetweenChunks(): Promise<void> {
  return Util.sleepRandom(DOC_DOWNLOAD_CHUNK_DELAY_MAX_MS, DOC_DOWNLOAD_CHUNK_DELAY_MIN_PCT / 100);
}
async function jitterSingleDownload(): Promise<void> {
  return Util.sleepRandom(
    DOC_DOWNLOAD_JITTER_DELAY_MAX_MS,
    DOC_DOWNLOAD_JITTER_DELAY_MIN_PCT / 100
  );
}

function reportDocQueryUsage(patient: Patient): void {
  reportUsage({
    cxId: patient.cxId,
    entityId: patient.id,
    apiType: ApiTypes.medical,
  });
}

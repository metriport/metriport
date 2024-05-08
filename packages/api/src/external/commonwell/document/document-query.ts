import { DocumentReference } from "@medplum/fhirtypes";
import {
  CommonwellError,
  Document,
  documentReferenceResourceType,
  OperationOutcome,
  operationOutcomeResourceType,
  organizationQueryMeta,
} from "@metriport/commonwell-sdk";
import { addOidPrefix } from "@metriport/core/domain/oid";
import { Patient } from "@metriport/core/domain/patient";
import { DownloadResult } from "@metriport/core/external/commonwell/document/document-downloader";
import { MedicalDataSource } from "@metriport/core/external/index";
import { MetriportError } from "@metriport/core/util/error/metriport-error";
import NotFoundError from "@metriport/core/util/error/not-found";
import { errorToString } from "@metriport/core/util/error/shared";
import { capture } from "@metriport/core/util/notifications";
import { elapsedTimeFromNow } from "@metriport/shared/common/date";
import httpStatus from "http-status";
import { chunk, partition } from "lodash";
import { removeDocRefMapping } from "../../../command/medical/docref-mapping/remove-docref-mapping";
import {
  getDocToFileFunction,
  getS3Info,
  getUrl,
  S3Info,
} from "../../../command/medical/document/document-query-storage-info";
import { analytics, EventTypes } from "../../../shared/analytics";
import { Config } from "../../../shared/config";
import { mapDocRefToMetriport } from "../../../shared/external";
import { Util } from "../../../shared/util";
import {
  isCQDirectEnabledForCx,
  isCWEnabledForCx,
  isEnhancedCoverageEnabledForCx,
} from "../../aws/appConfig";
import { reportMetric } from "../../aws/cloudwatch";
import { ingestIntoSearchEngine } from "../../aws/opensearch";
import { convertCDAToFHIR, isConvertible } from "../../fhir-converter/converter";
import { makeFhirApi } from "../../fhir/api/api-factory";
import { cwToFHIR } from "../../fhir/document";
import { processFhirResponse } from "../../fhir/document/process-fhir-search-response";
import { upsertDocumentToFHIRServer } from "../../fhir/document/save-document-reference";
import { reportFHIRError } from "../../fhir/shared/error-mapping";
import { getAllPages } from "../../fhir/shared/paginated";
import { HieInitiator } from "../../hie/get-hie-initiator";
import { buildInterrupt } from "../../hie/reset-doc-query-progress";
import { scheduleDocQuery } from "../../hie/schedule-document-query";
import { setDocQueryProgress } from "../../hie/set-doc-query-progress";
import { tallyDocQueryProgress } from "../../hie/tally-doc-query-progress";
import { makeCommonWellAPI } from "../api";
import { groupCWErrors } from "../error-categories";
import { getCWData, linkPatientToCW } from "../patient";
import { getPatientWithCWData, PatientWithCWData } from "../patient-external-data";
import { getCwInitiator } from "../shared";
import { makeDocumentDownloader } from "./document-downloader-factory";
import { sandboxGetDocRefsAndUpsert } from "./document-query-sandbox";
import {
  CWDocumentWithMetriportData,
  DocumentWithLocation,
  DocumentWithMetriportId,
  getFileName,
} from "./shared";

const DOC_DOWNLOAD_CHUNK_SIZE = 10;

const DOC_DOWNLOAD_JITTER_DELAY_MAX_MS = 3_000; // in milliseconds
const DOC_DOWNLOAD_JITTER_DELAY_MIN_PCT = 10; // 1-100% of max delay

const DOC_DOWNLOAD_CHUNK_DELAY_MAX_MS = 10_000; // in milliseconds
const DOC_DOWNLOAD_CHUNK_DELAY_MIN_PCT = 40; // 1-100% of max delay

type File = DownloadResult & { isNew: boolean };

/**
 * Query CommonWell for DocumentReferences, download and convert documents to FHIR,
 * and store the FHIR results (doc refs and resources from conversion) on the FHIR server.
 *
 * This is likely to be a long-running function, so it should likely be called asynchronously.
 *
 * @param patient - the patient to query for
 * @param facilityId - the facility to query for (optional if the patient only has one facility)
 * @param forceDownload - whether to force download the documents from CW, even if they are already
 * on S3 (optional) - see `downloadDocsAndUpsertFHIR()` for the default value
 * @param ignoreDocRefOnFHIRServer - whether to ignore the doc refs on the FHIR server and re-query
 * CW for them (optional) - see `downloadDocsAndUpsertFHIR()` for the default value
 */
export async function queryAndProcessDocuments({
  patient: patientParam,
  facilityId,
  forceQuery = false,
  forceDownload,
  ignoreDocRefOnFHIRServer,
  ignoreFhirConversionAndUpsert,
  requestId,
  getOrgIdExcludeList,
}: {
  patient: Patient;
  facilityId?: string | undefined;
  forceQuery?: boolean;
  forceDownload?: boolean;
  ignoreDocRefOnFHIRServer?: boolean;
  ignoreFhirConversionAndUpsert?: boolean;
  requestId: string;
  getOrgIdExcludeList: () => Promise<string[]>;
}): Promise<void> {
  const { id: patientId, cxId } = patientParam;
  const { log } = Util.out(`CW queryDocuments: ${requestId} - M patient ${patientId}`);

  if (Config.isSandbox()) {
    await sandboxGetDocRefsAndUpsert({
      patient: patientParam,
      requestId,
    });
    return;
  }

  const interrupt = buildInterrupt({ patientId, cxId, source: MedicalDataSource.COMMONWELL, log });
  if (!(await isCWEnabledForCx(cxId))) {
    return interrupt(`CW disabled for cx ${cxId}`);
  }

  try {
    const initiator = await getCwInitiator(patientParam, facilityId);

    await setDocQueryProgress({
      patient: { id: patientId, cxId },
      downloadProgress: { status: "processing" },
      convertProgress: { status: "processing" },
      requestId,
      source: MedicalDataSource.COMMONWELL,
    });

    const patientCWData = getCWData(patientParam.data.externalData);
    const hasNoCWStatus = !patientCWData || !patientCWData.status;
    const isProcessing = patientCWData?.status === "processing";

    if (hasNoCWStatus || isProcessing) {
      await scheduleDocQuery({
        requestId,
        patient: { id: patientId, cxId },
        source: MedicalDataSource.COMMONWELL,
      });

      if (hasNoCWStatus) {
        await linkPatientToCW(patientParam, initiator.facilityId, getOrgIdExcludeList);
      }

      return;
    }

    const startedAt = new Date();

    const [patient, isECEnabledForThisCx, isCQDirectEnabledForThisCx] = await Promise.all([
      getPatientWithCWData(patientParam),
      isEnhancedCoverageEnabledForCx(cxId),
      isCQDirectEnabledForCx(cxId),
    ]);

    if (!patient) {
      const msg = `Couldn't get CW Data for Patient`;
      throw new MetriportError(msg, undefined, {
        cxId,
        patientId,
      });
    }

    const cwData = patient.data.externalData.COMMONWELL;

    const isWaitingForEnhancedCoverage =
      isECEnabledForThisCx &&
      cwData.cqLinkStatus && // we're not waiting for EC if the patient was created before cqLinkStatus was introduced
      cwData.cqLinkStatus !== "linked";

    const isTriggerDQ = forceQuery || !isWaitingForEnhancedCoverage || isCQDirectEnabledForThisCx;

    if (!isTriggerDQ) return;

    log(`Querying for documents of patient ${patient.id}...`);
    const cwDocuments = await internalGetDocuments({
      patient,
      initiator,
    });
    log(`Got ${cwDocuments.length} documents from CW`);

    const duration = elapsedTimeFromNow(startedAt);

    analytics({
      distinctId: cxId,
      event: EventTypes.documentQuery,
      properties: {
        requestId,
        patientId,
        hie: MedicalDataSource.COMMONWELL,
        duration,
        documentCount: cwDocuments.length,
      },
    });

    const fhirDocRefs = await downloadDocsAndUpsertFHIR({
      patient,
      facilityId,
      documents: cwDocuments,
      forceDownload,
      ignoreDocRefOnFHIRServer,
      ignoreFhirConversionAndUpsert,
      requestId,
    });

    log(`Finished processing ${fhirDocRefs.length} documents.`);
  } catch (error) {
    const msg = `Failed to query and process documents - CommonWell`;
    log(`${msg}. Error: ${errorToString(error)}`);

    await setDocQueryProgress({
      patient: { id: patientParam.id, cxId: patientParam.cxId },
      downloadProgress: { status: "failed" },
      requestId,
      source: MedicalDataSource.COMMONWELL,
    });

    const cwReference = error instanceof CommonwellError ? error.cwReference : undefined;

    capture.message(msg, {
      extra: {
        context: `cw.queryAndProcessDocuments`,
        error,
        patientId: patientParam.id,
        facilityId,
        forceDownload,
        requestId,
        ignoreDocRefOnFHIRServer,
        cwReference,
      },
      level: "error",
    });
    throw error;
  }
}

/**
 * Query for doc refs @ CommonWell. Those are not the documents themselves, just
 * references to them.
 *
 * @returns document references with CW format
 */
export async function internalGetDocuments({
  patient,
  initiator,
}: {
  patient: PatientWithCWData;
  initiator: HieInitiator;
}): Promise<Document[]> {
  const context = "cw.queryDocument";
  const { log } = Util.out(`CW internalGetDocuments - M patient ${patient.id}`);

  const cwData = patient.data.externalData.COMMONWELL;

  const reportDocQueryMetric = (queryStart: number) => {
    const queryDuration = Date.now() - queryStart;
    reportMetric({
      name: context,
      value: queryDuration,
      unit: "Milliseconds",
      additionalDimension: "CommonWell",
    });
  };
  const commonWell = makeCommonWellAPI(initiator.name, addOidPrefix(initiator.oid));
  const queryMeta = organizationQueryMeta(initiator.oid, { npi: initiator.npi });

  const docs: Document[] = [];
  const cwErrs: OperationOutcome[] = [];
  const queryStart = Date.now();
  try {
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
  } catch (error) {
    throw new CommonwellError("Error querying documents from CommonWell", error, {
      cwReference: commonWell.lastReferenceHeader,
      context,
    });
  }
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
    const msg = `CW Document query error`;
    log(`${msg} - Category: ${category}. Cause: ${JSON.stringify(errors)}`);
    capture.message(msg, {
      extra: { ...context, errors, category },
      level: "error",
    });
  }
}

async function initPatientDocQuery(
  patient: Patient,
  totalDocs: number,
  convertibleDocs: number,
  requestId: string
): Promise<Patient> {
  return setDocQueryProgress({
    patient: { id: patient.id, cxId: patient.cxId },
    downloadProgress: {
      status: "processing",
      total: totalDocs,
    },
    convertProgress: {
      status: "processing",
      total: convertibleDocs,
    },
    requestId,
    source: MedicalDataSource.COMMONWELL,
  });
}

// custom type guard, this is dangerous as the compiler can't tell whether we're checking or not - but either this or exclamation point
function isValidDoc(doc: DocumentWithMetriportId): doc is DocumentWithLocation {
  const docLocation = doc.content.location;
  if (!docLocation) {
    console.log(
      `Doc without location, skipping - fhirDocId ${doc.id}, originalDocId ${doc.originalId}`
    );
    return false;
  }
  return true;
}

function convertToNonExistingS3Info(
  patient: Patient
): (doc: DocumentWithMetriportId) => Promise<S3Info> {
  return async (doc: DocumentWithMetriportId): Promise<S3Info> => {
    const docToFile = getDocToFileFunction(patient);
    const simpleFile = await docToFile(doc);
    return {
      ...simpleFile,
      fileExists: false,
      fileSize: undefined,
    };
  };
}

function addMetriportDocRefId({
  cxId,
  patientId,
  requestId,
}: {
  cxId: string;
  patientId: string;
  requestId: string;
}) {
  return async (document: Document): Promise<DocumentWithMetriportId> => {
    const documentId = document.content?.masterIdentifier?.value || document.id;

    const { metriportId, originalId } = await mapDocRefToMetriport({
      cxId,
      patientId,
      documentId,
      requestId,
      source: MedicalDataSource.COMMONWELL,
    });
    return {
      ...document,
      originalId: originalId,
      id: metriportId,
    };
  };
}

/**
 * Downloads documents from CommonWell DocumentReferences, storing them on S3. Additionally,
 * converts them to FHIR resources if they're CCDA, stores the results on the FHIR server.
 *
 * @param patient - the patient to query for
 * @param facilityId - the facility to determine the NPI to be used for the query @ CW
 * @param documents - the CommonWell document references to download and convert
 * @param forceDownload - whether to force download the documents from CW, even if they are already
 * on S3 (optional) - defaults to `false`
 * @param ignoreDocRefOnFHIRServer - whether to ignore the doc refs on the FHIR server and re-query
 * CW for them (optional) - defaults to `false`
 * @returns Document References as they were stored on the FHIR server
 */
async function downloadDocsAndUpsertFHIR({
  patient,
  facilityId,
  documents,
  forceDownload = false,
  ignoreDocRefOnFHIRServer = false,
  ignoreFhirConversionAndUpsert = false,
  requestId,
}: {
  patient: Patient;
  facilityId?: string;
  documents: Document[];
  forceDownload?: boolean;
  ignoreDocRefOnFHIRServer?: boolean;
  ignoreFhirConversionAndUpsert?: boolean;
  requestId: string;
}): Promise<DocumentReference[]> {
  const { log } = Util.out(
    `CW downloadDocsAndUpsertFHIR - requestId ${requestId}, M patient ${patient.id}`
  );
  forceDownload && log(`override=true, NOT checking whether docs exist`);

  const cxId = patient.cxId;
  const fhirApi = makeFhirApi(patient.cxId);
  const docsNewLocation: DocumentReference[] = [];
  let errorCountConvertible = 0;
  let increaseCountConvertible = 0;
  const shouldUpsertFHIR = !ignoreFhirConversionAndUpsert;

  const docsWithMetriportId = await Promise.all(
    documents.map(
      addMetriportDocRefId({
        cxId: patient.cxId,
        patientId: patient.id,
        requestId,
      })
    )
  );

  const validDocs = docsWithMetriportId.filter(isValidDoc);
  log(`I have ${validDocs.length} valid docs to process`);

  // Get File info from S3 (or from memory, if override = true)
  const getFilesWithStorageInfo = async () =>
    forceDownload
      ? await Promise.all(validDocs.map(convertToNonExistingS3Info(patient)))
      : await getS3Info(validDocs, patient);

  // Get all DocumentReferences for this patient + File info from S3
  const [foundOnFHIR, filesWithStorageInfo] = await Promise.all([
    ignoreDocRefOnFHIRServer
      ? []
      : getAllPages(() =>
          fhirApi.searchResourcePages("DocumentReference", `patient=${patient.id}`)
        ),
    getFilesWithStorageInfo(),
  ]);

  const [foundOnStorage, notFoundOnStorage] = partition(
    filesWithStorageInfo,
    (f: S3Info) => f.fileExists
  );
  // Make sure the found ones are on FHIR, otherwise also download them and store on FHIR
  const foundOnStorageButNotOnFHIR = foundOnStorage.filter(
    f => !foundOnFHIR.find(d => d.id === f.docId)
  );
  const filesToDownload = notFoundOnStorage.concat(foundOnStorageButNotOnFHIR);

  const docsToDownload = filesToDownload.flatMap(f => validDocs.find(d => d.id === f.docId) ?? []);

  const fileInfoByDocId = (docId: string) => filesWithStorageInfo.find(f => f.docId === docId);

  const convertibleDocCount = docsToDownload.filter(doc =>
    isConvertible(doc.content?.mimeType)
  ).length;
  log(`I have ${docsToDownload.length} docs to download (${convertibleDocCount} convertible)`);
  await initPatientDocQuery(patient, docsToDownload.length, convertibleDocCount, requestId);

  // TODO move to executeAsynchronously() from core
  // split the list in chunks
  const chunks = chunk(docsToDownload, DOC_DOWNLOAD_CHUNK_SIZE);
  for (const docChunk of chunks) {
    const s3Refs = await Promise.allSettled(
      docChunk.map(async doc => {
        let errorReported = false;
        let uploadToS3: () => Promise<File>;
        let file: Awaited<ReturnType<typeof uploadToS3>> | undefined = undefined;
        const isConvertibleDoc = isConvertible(doc.content?.mimeType);

        try {
          const fileInfo = fileInfoByDocId(doc.id);
          if (!fileInfo) {
            if (isConvertibleDoc && !ignoreFhirConversionAndUpsert) increaseCountConvertible--;
            throw new MetriportError("Missing file info", undefined, { docId: doc.id });
          }

          try {
            // add some randomness to avoid overloading the servers
            await jitterSingleDownload();

            if (!fileInfo.fileExists) {
              // Download from CW and upload to S3
              uploadToS3 = async () => {
                const initiator = await getCwInitiator({ id: patient.id, cxId }, facilityId);
                const newFile = triggerDownloadDocument({
                  doc,
                  fileInfo,
                  initiator,
                  cxId,
                  requestId,
                });

                return newFile;
              };
            } else {
              // Get info from existing S3 file
              uploadToS3 = async () => {
                const signedUrl = await getUrl(fileInfo.fileName, fileInfo.fileLocation);
                const url = new URL(signedUrl);
                const s3Location = url.origin + url.pathname;
                return {
                  bucket: fileInfo.fileLocation,
                  key: fileInfo.fileName,
                  location: s3Location,
                  contentType: fileInfo.fileContentType,
                  size: fileInfo.fileSize,
                  isNew: false,
                };
              };
            }
            file = await uploadToS3();
          } catch (error) {
            // Remove the doc ref mapping we created early in this function
            try {
              await removeDocRefMapping({ cxId, docRefMappingId: doc.id });
            } catch (error2) {
              log(`Error removing docRefMapping (${doc.id}): ${errorToString(error2)}`);
            }

            if (isConvertibleDoc && !ignoreFhirConversionAndUpsert) errorCountConvertible++;

            const isZeroLength = doc.content.size === 0;
            if (isZeroLength || error instanceof NotFoundError) {
              // we don't want to report errors when the file was originally flagged as empty or not found
              errorReported = true;
              throw error;
            }
            const msg = `Error downloading from CW and upserting to FHIR`;
            log(`${msg}: (docId ${doc.id}): ${errorToString(error)}`);
            capture.error(msg, {
              extra: {
                context: `s3.documentUpload`,
                patientId: patient.id,
                documentReference: doc,
                requestId,
                error,
              },
              level: "error",
            });
            throw error;
          }

          // If an xml document contained b64 data, we will parse, convert and store it in s3 as the default downloaded document.
          // Because of this the document content type may not match the s3 file content type hence this check.
          // This will prevent us from converting non xml documents to FHIR.
          const isFileConvertible = fileIsConvertible(file);

          const shouldConvertCDA =
            file.isNew && !ignoreFhirConversionAndUpsert && isFileConvertible;

          const docWithFile: CWDocumentWithMetriportData = {
            ...doc,
            metriport: {
              fileName: file.key,
              location: file.location,
              fileSize: file.size,
              fileContentType: file.contentType,
            },
          };

          if (!shouldConvertCDA && isConvertibleDoc) {
            increaseCountConvertible--;
          } else if (shouldConvertCDA && !isConvertibleDoc) {
            increaseCountConvertible++;
          }

          if (shouldConvertCDA) {
            try {
              await convertCDAToFHIR({
                patient,
                document: doc,
                s3FileName: file.key,
                s3BucketName: file.bucket,
                requestId,
                source: MedicalDataSource.COMMONWELL,
              });
            } catch (err) {
              // don't fail/throw or send to Sentry here, we already did that on the convertCDAToFHIR function
              log(
                `Error triggering conversion of doc ${doc.id}, just increasing errorCountConvertible - ${err}`
              );
              errorCountConvertible++;
            }
          }

          const fhirDocRef = cwToFHIR(doc.id, docWithFile, patient);

          if (shouldUpsertFHIR) {
            const [fhir] = await Promise.allSettled([
              upsertDocumentToFHIRServer(cxId, fhirDocRef, log).catch(error => {
                const context = "upsertDocumentToFHIRServer";
                const extra = {
                  context: `cw.document-query.` + context,
                  patientId: patient.id,
                  documentReference: doc,
                  originalError: error,
                };

                reportFHIRError({ docId: doc.id, error, context, log, extra });
                errorReported = true;
                throw error;
              }),
              ingestIntoSearchEngine(
                patient,
                fhirDocRef,
                {
                  key: file.key,
                  bucket: file.bucket,
                  contentType: file.contentType,
                },
                requestId,
                log
              ),
            ]);
            processFhirResponse(patient, doc.id, fhir);
          }

          await tallyDocQueryProgress({
            patient: { id: patient.id, cxId: patient.cxId },
            progress: {
              successful: 1,
            },
            type: "download",
            requestId,
            source: MedicalDataSource.COMMONWELL,
          });

          return fhirDocRef;
        } catch (error) {
          await tallyDocQueryProgress({
            patient: { id: patient.id, cxId: patient.cxId },
            progress: {
              errors: 1,
            },
            type: "download",
            requestId,
            source: MedicalDataSource.COMMONWELL,
          });

          const msg = `Error processing doc from CW`;
          log(`${msg}: ${error}; doc ${JSON.stringify(doc)}`);
          if (!errorReported && !(error instanceof NotFoundError)) {
            capture.message(msg, {
              extra: {
                context: `cw.downloadDocsAndUpsertFHIR`,
                patientId: patient.id,
                document: doc,
                requestId,
                error,
              },
              level: "error",
            });
          }
          throw error;
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

  await setDocQueryProgress({
    patient: { id: patient.id, cxId: patient.cxId },
    downloadProgress: { status: "completed" },
    ...(convertibleDocCount <= 0
      ? {
          convertProgress: {
            status: "completed",
            total: 0,
          },
        }
      : undefined),
    convertibleDownloadErrors: errorCountConvertible,
    increaseCountConvertible,
    requestId,
    source: MedicalDataSource.COMMONWELL,
  });

  return docsNewLocation;
}

async function triggerDownloadDocument({
  doc,
  fileInfo,
  initiator,
  cxId,
  requestId,
}: {
  doc: DocumentWithLocation;
  fileInfo: S3Info;
  initiator: HieInitiator;
  cxId: string;
  requestId: string;
}): Promise<File> {
  const docDownloader = makeDocumentDownloader(initiator);
  const document = {
    id: doc.id,
    mimeType: doc.content.mimeType,
    location: doc.content.location,
  };
  const adjustedFileInfo = {
    name: fileInfo.fileName,
    location: fileInfo.fileLocation,
  };

  try {
    const result = await docDownloader.download({ document, fileInfo: adjustedFileInfo, cxId });
    return {
      ...result,
      isNew: true,
    };
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
  } catch (error: any) {
    if (error.status === httpStatus.NOT_FOUND) {
      console.log(
        `Document not found on CW, skipping - requestId: ${requestId}. ` +
          `Error: ${errorToString(error)}`
      );
      throw new NotFoundError("Document not found on CW", error, { requestId });
    } else {
      throw error;
    }
  }
}

const fileIsConvertible = (f: File) => isConvertible(f.contentType);

async function sleepBetweenChunks(): Promise<void> {
  return Util.sleepRandom(DOC_DOWNLOAD_CHUNK_DELAY_MAX_MS, DOC_DOWNLOAD_CHUNK_DELAY_MIN_PCT / 100);
}
async function jitterSingleDownload(): Promise<void> {
  return Util.sleepRandom(
    DOC_DOWNLOAD_JITTER_DELAY_MAX_MS,
    DOC_DOWNLOAD_JITTER_DELAY_MIN_PCT / 100
  );
}

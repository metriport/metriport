import { DocumentReference } from "@medplum/fhirtypes";
import {
  Document,
  documentReferenceResourceType,
  OperationOutcome,
  operationOutcomeResourceType,
  organizationQueryMeta,
} from "@metriport/commonwell-sdk";
import { oid } from "@metriport/core/domain/oid";
import { DownloadResult } from "@metriport/core/external/commonwell/document/document-downloader";
import httpStatus from "http-status";
import { chunk, partition } from "lodash";
import {
  getDocToFileFunction,
  getS3Info,
  getUrl,
  S3Info,
} from "../../../command/medical/document/document-query-storage-info";
import {
  MAPIWebhookStatus,
  processPatientDocumentRequest,
} from "../../../command/medical/document/document-webhook";
import { appendDocQueryProgress } from "../../../command/medical/patient/append-doc-query-progress";
import { getPatientOrFail } from "../../../command/medical/patient/get-patient";
import { reportUsage } from "../../../command/usage/report-usage";
import { Facility } from "../../../domain/medical/facility";
import { Organization } from "../../../domain/medical/organization";
import { Patient } from "../../../domain/medical/patient";
import { Product } from "../../../domain/product";
import ConversionError from "../../../errors/conversion-error";
import MetriportError from "../../../errors/metriport-error";
import NotFoundError from "../../../errors/not-found";
import { MedicalDataSource } from "../../../external";
import { toDTO } from "../../../routes/medical/dtos/documentDTO";
import { Config } from "../../../shared/config";
import { mapDocRefToMetriport } from "../../../shared/external";
import { errorToString } from "../../../shared/log";
import { capture } from "../../../shared/notifications";
import { Util } from "../../../shared/util";
import { isEnhancedCoverageEnabledForCx } from "../../aws/appConfig";
import { reportMetric } from "../../aws/cloudwatch";
import { convertCDAToFHIR, isConvertible } from "../../fhir-converter/converter";
import { makeFhirApi } from "../../fhir/api/api-factory";
import { DocumentReferenceWithId, toFHIR as toFHIRDocRef } from "../../fhir/document";
import { upsertDocumentToFHIRServer } from "../../fhir/document/save-document-reference";
import { groupFHIRErrors, tryDetermineFhirError } from "../../fhir/shared/error-mapping";
import { getAllPages } from "../../fhir/shared/paginated";
import { makeSearchServiceIngest } from "../../opensearch/file-search-connector-factory";
import { makeCommonWellAPI } from "../api";
import { groupCWErrors } from "../error-categories";
import { getPatientWithCWData, PatientWithCWData } from "../patient-external-data";
import { getPatientDataWithSingleFacility } from "../patient-shared";
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
}: {
  patient: Patient;
  facilityId?: string | undefined;
  forceQuery?: boolean;
  forceDownload?: boolean;
  ignoreDocRefOnFHIRServer?: boolean;
  ignoreFhirConversionAndUpsert?: boolean;
  requestId: string;
}): Promise<number> {
  const { log } = Util.out(`CW queryDocuments: ${requestId} - M patient ${patientParam.id}`);

  try {
    const [patient, isECEnabledForThisCx] = await Promise.all([
      getPatientWithCWData(patientParam),
      isEnhancedCoverageEnabledForCx(patientParam.cxId),
    ]);

    if (!patient && isECEnabledForThisCx) {
      log(`Couldn't get CW Data for Patient, but EC is enabled for CX, skipping DQ.`);
      return 0;
    }
    if (!patient) {
      const msg = `Couldn't get CW Data for Patient`;
      throw new MetriportError(msg, undefined, {
        cxId: patientParam.cxId,
        patientId: patientParam.id,
      });
    }
    const cwData = patient.data.externalData.COMMONWELL;

    const isWaitingForEnhancedCoverage =
      isECEnabledForThisCx &&
      cwData.cqLinkStatus && // we're not waiting for EC if the patient was created before cqLinkStatus was introduced
      cwData.cqLinkStatus !== "linked";

    const isTriggerDQ = forceQuery || !isWaitingForEnhancedCoverage;
    if (!isTriggerDQ) return 0;

    const { organization, facility } = await getPatientDataWithSingleFacility(patient, facilityId);

    if (Config.isSandbox()) {
      const documentsSandbox = await sandboxGetDocRefsAndUpsert({
        organization,
        patient,
        requestId,
      });
      return documentsSandbox.length;
    } else {
      log(`Querying for documents of patient ${patient.id}...`);
      const cwDocuments = await internalGetDocuments({ patient, organization, facility });
      log(`Got ${cwDocuments.length} documents from CW`);

      const fhirDocRefs = await downloadDocsAndUpsertFHIR({
        patient,
        facilityId,
        documents: cwDocuments,
        forceDownload,
        ignoreDocRefOnFHIRServer,
        ignoreFhirConversionAndUpsert,
        requestId,
      });

      if (
        fhirDocRefs.length &&
        forceDownload === undefined &&
        ignoreDocRefOnFHIRServer === undefined
      ) {
        reportDocQueryUsage(patient);
      }

      log(`Finished processing ${fhirDocRefs.length} documents.`);
      return fhirDocRefs.length;
    }
  } catch (error) {
    const msg = `Failed to query and process documents`;
    console.log(`${msg}. Error: ${errorToString(error)}`);
    processPatientDocumentRequest(
      patientParam.cxId,
      patientParam.id,
      "medical.document-download",
      MAPIWebhookStatus.failed
    );
    await appendDocQueryProgress({
      patient: { id: patientParam.id, cxId: patientParam.cxId },
      downloadProgress: { status: "failed" },
      requestId,
    });
    capture.message(msg, {
      extra: {
        context: `cw.queryAndProcessDocuments`,
        error,
        patientId: patientParam.id,
        facilityId,
        forceDownload,
        requestId,
        ignoreDocRefOnFHIRServer,
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
  organization,
  facility,
}: {
  patient: PatientWithCWData;
  organization: Organization;
  facility: Facility;
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

  const orgName = organization.data.name;
  const orgOID = organization.oid;
  const facilityNPI = facility.data["npi"] as string; // TODO #414 move to strong type - remove `as string`
  const commonWell = makeCommonWellAPI(orgName, oid(orgOID));
  const queryMeta = organizationQueryMeta(orgName, { npi: facilityNPI });

  const docs: Document[] = [];
  const cwErrs: OperationOutcome[] = [];
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

function reportFHIRError({
  patientId,
  doc,
  error,
  context,
  log,
}: {
  patientId: string;
  doc: Document;
  error: unknown;
  context: string;
  log: ReturnType<typeof Util.out>["log"];
}) {
  const errorTitle = `CDA>FHIR ${context}`;
  const extra = {
    context: `cw.document-query.` + context,
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
  convertibleDocs: number,
  requestId: string
): Promise<Patient> {
  return appendDocQueryProgress({
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

function addMetriportDocRefId({ cxId, patientId }: { cxId: string; patientId: string }) {
  return async (document: Document): Promise<DocumentWithMetriportId> => {
    const { metriportId, originalId } = await mapDocRefToMetriport({
      cxId,
      patientId,
      document,
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
export async function downloadDocsAndUpsertFHIR({
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
  let completedCount = 0;
  let errorCount = 0;
  let errorCountConvertible = 0;
  let increaseCountConvertible = 0;
  const shouldUpsertFHIR = !ignoreFhirConversionAndUpsert;

  const docsWithMetriportId = await Promise.all(
    documents.map(
      addMetriportDocRefId({
        cxId: patient.cxId,
        patientId: patient.id,
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
                const { organization, facility } = await getPatientDataWithSingleFacility(
                  { id: patient.id, cxId },
                  facilityId
                );
                const facilityNPI = facility.data["npi"] as string; // TODO #414 move

                const newFile = triggerDownloadDocument({
                  doc,
                  fileInfo,
                  organization,
                  facilityNPI,
                  cxId,
                  requestId,
                });

                return newFile;
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
                  contentType: fileInfo.fileContentType,
                  size: fileInfo.fileSize,
                  isNew: false,
                };
              };
            }
            file = await uploadToS3();
          } catch (error) {
            if (isConvertibleDoc && !ignoreFhirConversionAndUpsert) errorCountConvertible++;

            const isZeroLength = doc.content.size === 0;
            if (isZeroLength && error instanceof NotFoundError) {
              // we don't want to report errors when the file was originally flagged as empty
              errorReported = true;
              throw error;
            }
            const msg = `Error downloading from CW and upserting to FHIR`;
            const zeroLengthDetailsStr = isZeroLength ? "zero length document" : "";
            log(`${msg}: ${zeroLengthDetailsStr}, (docId ${doc.id}): ${error}`);
            capture.message(msg, {
              extra: {
                context: `s3.documentUpload`,
                patientId: patient.id,
                documentReference: doc,
                isZeroLength,
                requestId,
                error,
              },
              level: "error",
            });
            errorReported = true;
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
              });
            } catch (err) {
              // don't fail/throw or send to Sentry here, we already did that on the convertCDAToFHIR function
              log(
                `Error triggering conversion of doc ${doc.id}, just increasing errorCountConvertible - ${err}`
              );
              errorCountConvertible++;
            }
          }

          const FHIRDocRef = toFHIRDocRef(doc.id, docWithFile, patient);

          if (shouldUpsertFHIR) {
            const [fhir] = await Promise.allSettled([
              upsertDocumentToFHIRServer(cxId, FHIRDocRef, log).catch(error => {
                const context = "upsertDocumentToFHIRServer";
                reportFHIRError({ patientId: patient.id, doc, error, context, log });
                errorReported = true;
                throw error;
              }),
              ingestIntoSearchEngine(patient, FHIRDocRef, file, requestId, log),
            ]);
            processFhirAndSearchResponse(patient, doc, fhir);
          }

          completedCount++;

          return FHIRDocRef;
        } catch (error) {
          errorCount++;
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
        } finally {
          // TODO: eventually we will have to update this to support multiple HIEs
          try {
            await appendDocQueryProgress({
              patient: { id: patient.id, cxId: patient.cxId },
              downloadProgress: {
                status: "processing",
                successful: completedCount,
                errors: errorCount,
              },
              requestId,
            });
          } catch (error) {
            const msg = `Failed to append doc query progress`;
            console.log(`${msg}. Cause: ${error}`);
            capture.message(msg, {
              extra: { context: `cw.downloadDocsAndUpsertFHIR`, patient, requestId, error },
              level: "error",
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

  const updatedPatient = await appendDocQueryProgress({
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
  });
  // send webhook to CXs when docs are done downloading
  processPatientDocumentRequest(
    cxId,
    patient.id,
    "medical.document-download",
    MAPIWebhookStatus.completed,
    toDTO(docsNewLocation)
  );
  // send webhook to CXs if docs are done converting (at this point only if no conversions to be done)
  const patientFromDB = await getPatientOrFail({ cxId: patient.cxId, id: patient.id });
  const conversionStatusFromDB = patientFromDB.data.documentQueryProgress?.convert?.status;
  const conversionStatusFromAppend = updatedPatient.data.documentQueryProgress?.convert?.status;
  if (conversionStatusFromAppend === "completed" || conversionStatusFromDB === "completed") {
    processPatientDocumentRequest(
      cxId,
      patient.id,
      "medical.document-conversion",
      MAPIWebhookStatus.completed
    );
    if (conversionStatusFromAppend !== conversionStatusFromDB) {
      log(
        `Conversion status from DB and append are different! ` +
          `fromAppend: ${conversionStatusFromAppend}, ` +
          `fromDB: ${conversionStatusFromDB}`
      );
    }
  }

  return docsNewLocation;
}

function processFhirAndSearchResponse(
  patient: Patient,
  doc: DocumentWithLocation,
  fhir: PromiseSettledResult<void>
): void {
  const base = { patientId: patient.id, docId: doc.id };
  if (fhir.status === "rejected") {
    throw new MetriportError("Error upserting to FHIR", undefined, {
      ...base,
      failed: fhir.reason,
    });
  }
}

async function triggerDownloadDocument({
  doc,
  fileInfo,
  organization,
  facilityNPI,
  cxId,
  requestId,
}: {
  doc: DocumentWithLocation;
  fileInfo: S3Info;
  organization: Organization;
  facilityNPI: string;
  cxId: string;
  requestId: string;
}): Promise<File> {
  const docDownloader = makeDocumentDownloader({
    orgName: organization.data.name,
    orgOid: organization.oid,
    npi: facilityNPI,
  });
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
      console.log(`Document not found on CW, skipping - requestId: ${requestId}. Error: ${error}`);
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

async function ingestIntoSearchEngine(
  patient: Patient,
  fhirDoc: DocumentReferenceWithId,
  file: File,
  requestId: string,
  log = console.log
): Promise<void> {
  const openSearch = makeSearchServiceIngest();
  if (!openSearch.isIngestible({ contentType: file.contentType, fileName: file.key })) {
    log(
      `Skipping ingestion of doc ${fhirDoc.id} / file ${file.key} into OpenSearch: not ingestible`
    );
    return;
  }
  try {
    await openSearch.ingest({
      cxId: patient.cxId,
      patientId: patient.id,
      entryId: fhirDoc.id,
      s3FileName: file.key,
      s3BucketName: file.bucket,
      requestId,
    });
  } catch (error) {
    const msg = `Error ingesting doc into OpenSearch`;
    log(`${msg}. Document ID: ${fhirDoc.id}, file key: ${file.key}: ${errorToString(error)}`);
    capture.message(msg, {
      extra: {
        context: `ingestIntoSearchEngine`,
        patientId: patient.id,
        file,
        requestId,
        error,
      },
      level: "error",
    });
    // intentionally not throwing here, we don't want to fail b/c of search ingestion
  }
}

function reportDocQueryUsage(patient: Patient, docQuery = true): void {
  reportUsage({
    cxId: patient.cxId,
    entityId: patient.id,
    product: Product.medical,
    docQuery,
  });
}

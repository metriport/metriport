import { DocumentReference } from "@medplum/fhirtypes";
import {
  CommonwellError,
  Document,
  documentReferenceResourceType,
  OperationOutcome,
  operationOutcomeResourceType,
} from "@metriport/commonwell-sdk";
import { chunk, partition } from "lodash";
import {
  getDocToFileFunction,
  getFileInfoFromS3,
  getS3Info,
  getUrl,
  S3Info,
  uploadStream,
} from "../../../command/medical/document/document-query-storage-info";
import { appendDocQueryProgress } from "../../../command/medical/patient/append-doc-query-progress";
import { getPatientOrFail } from "../../../command/medical/patient/get-patient";
import { ApiTypes, reportUsage } from "../../../command/usage/report-usage";
import { MAPIWebhookStatus, processPatientDocumentRequest } from "../../../command/webhook/medical";
import ConversionError from "../../../errors/conversion-error";
import MetriportError from "../../../errors/metriport-error";
import { MedicalDataSource } from "../../../external";
import { Facility } from "../../../models/medical/facility";
import { Organization } from "../../../models/medical/organization";
import { Patient } from "../../../models/medical/patient";
import { toDTO } from "../../../routes/medical/dtos/documentDTO";
import { Config } from "../../../shared/config";
import { mapDocRefToMetriport } from "../../../shared/external";
import { capture } from "../../../shared/notifications";
import { oid } from "../../../shared/oid";
import { Util } from "../../../shared/util";
import { reportMetric } from "../../aws/cloudwatch";
import { convertCDAToFHIR, isConvertible } from "../../fhir-converter/converter";
import { makeFhirApi } from "../../fhir/api/api-factory";
import { toFHIR as toFHIRDocRef } from "../../fhir/document";
import { upsertDocumentToFHIRServer } from "../../fhir/document/save-document-reference";
import { groupFHIRErrors, tryDetermineFhirError } from "../../fhir/shared/error-mapping";
import { getAllPages } from "../../fhir/shared/paginated";
import { makeCommonWellAPI, organizationQueryMeta } from "../api";
import { groupCWErrors } from "../error-categories";
import { getPatientData, PatientDataCommonwell } from "../patient-shared";
import { downloadDocument as downloadDocumentFromCW } from "./document-download";
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
      "medical.document-download",
      MAPIWebhookStatus.failed
    );
    await appendDocQueryProgress({
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
  const orgOID = organization.oid;
  const facilityNPI = facility.data["npi"] as string; // TODO #414 move to strong type - remove `as string`
  const commonWell = makeCommonWellAPI(orgName, oid(orgOID));
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
        extra: { document: d },
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
    override
      ? await Promise.all(validDocs.map(convertToNonExistingS3Info(patient)))
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
  const foundOnStorageButNotOnFHIR = foundOnStorage.filter(
    f => !foundOnFHIR.find(d => d.id === f.docId)
  );
  const filesToDownload = notFoundOnStorage.concat(foundOnStorageButNotOnFHIR);

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
          if (!fileInfo) {
            throw new MetriportError("Missing file info", undefined, { docId: doc.id });
          }

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
            try {
              await convertCDAToFHIR({
                patient,
                document: doc,
                s3FileName: file.key,
                s3BucketName: file.bucket,
              });
            } catch (err) {
              // don't fail/throw or send to Sentry here, we already did that on the convertCDAToFHIR function
              log(
                `Error triggering conversion of doc ${doc.id}, just increasing errorCountConvertible - ${err}`
              );
              errorCountConvertible++;
            }
          } else {
            // count this doc as an error so we can decrement the total to be converted in the query status
            errorCountConvertible++;
          }

          const FHIRDocRef = toFHIRDocRef(doc.id, docWithFile, organization, patient);
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
            await appendDocQueryProgress({
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
  });
  // send webhook to CXs when docs are done downloading
  processPatientDocumentRequest(
    organization.cxId,
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
      organization.cxId,
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

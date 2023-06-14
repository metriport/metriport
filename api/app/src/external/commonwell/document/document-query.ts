import { DocumentReference } from "@medplum/fhirtypes";
import {
  CommonwellError,
  Document,
  documentReferenceResourceType,
  OperationOutcome,
  operationOutcomeResourceType,
} from "@metriport/commonwell-sdk";
import { chunk } from "lodash";
import { PassThrough } from "stream";
import { updateDocQuery } from "../../../command/medical/document/document-query";
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
import { createS3FileName, getDocumentPrimaryId } from "../../../shared/external";
import { capture } from "../../../shared/notifications";
import { oid } from "../../../shared/oid";
import { Util } from "../../../shared/util";
import { reportMetric } from "../../aws/cloudwatch";
import { makeS3Client } from "../../aws/s3";
import { convertCDAToFHIR } from "../../fhir-converter/converter";
import { MAX_FHIR_DOC_ID_LENGTH, toFHIR as toFHIRDocRef } from "../../fhir/document";
import { upsertDocumentToFHIRServer } from "../../fhir/document/save-document-reference";
import { groupFHIRErrors, tryDetermineFhirError } from "../../fhir/shared/error-mapping";
import { makeCommonWellAPI, organizationQueryMeta } from "../api";
import { groupCWErrors } from "../error-categories";
import { getPatientData, PatientDataCommonwell } from "../patient-shared";
import { downloadDocument as downloadDocumentFromCW } from "./document-download";
import { sandboxGetDocRefsAndUpsert } from "./document-query-sandbox";
import { CWDocumentWithMetriportData, getFileName } from "./shared";

const s3Client = makeS3Client();

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
      processPatientDocumentRequest(
        organization.cxId,
        patient.id,
        MAPIWebhookType.documentDownload,
        MAPIWebhookStatus.completed,
        toDTO(documentsSandbox)
      );
      return documentsSandbox.length;
    } else {
      log(`Querying for documents of patient ${patient.id}...`);
      const cwDocuments = await internalGetDocuments({ patient, organization, facility });
      log(`Found ${cwDocuments.length} documents`);

      const FHIRDocRefs = await downloadDocsAndUpsertFHIR({
        patient,
        organization,
        facilityId,
        documents: cwDocuments,
        override,
      });

      reportDocQueryUsage(patient);

      // send webhook to cx async when docs are done downloading
      processPatientDocumentRequest(
        organization.cxId,
        patient.id,
        MAPIWebhookType.documentDownload,
        MAPIWebhookStatus.completed,
        toDTO(FHIRDocRefs)
      );

      await updateDocQuery({
        patient: { id: patient.id, cxId: patient.cxId },
        downloadProgress: { status: "completed" },
      });

      return FHIRDocRefs.length;
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
  const s3BucketName = Config.getMedicalDocumentsBucketName();

  const uploadStream = (s3FileName: string, contentType?: string) => {
    const pass = new PassThrough();
    return {
      writeStream: pass,
      promise: s3Client
        .upload({
          Bucket: s3BucketName,
          Key: s3FileName,
          Body: pass,
          ContentType: contentType ? contentType : "text/xml",
        })
        .promise(),
    };
  };

  const docsNewLocation: DocumentReference[] = [];
  let completedCount = 0;
  let errorCount = 0;
  let fhirConvertCount = 0;

  // split the list in chunks
  const chunks = chunk(documents, DOC_DOWNLOAD_CHUNK_SIZE);
  for (const docChunk of chunks) {
    const s3Refs = await Promise.allSettled(
      docChunk.map(async doc => {
        let errorReported = false;
        try {
          const fhirDocId = getDocumentPrimaryId(doc);
          // Make this before download and insert on S3 bc of https://metriport.slack.com/archives/C04DBBJSKGB/p1684113732495119?thread_ts=1684105959.041439&cid=C04DBBJSKGB
          if (fhirDocId.length > MAX_FHIR_DOC_ID_LENGTH) {
            throw new MetriportError("FHIR doc ID too long", undefined, { fhirDocId });
          }

          const docLocation = doc.content.location;
          if (!docLocation) {
            errorCount++;
            log(`Doc without location, skipping - docId ${fhirDocId}`);
            return;
          }

          const s3FileName = createS3FileName(patient.cxId, fhirDocId);
          const { exists: fileExists, size: existingSize } = await getFileInfoFromS3(
            s3FileName,
            s3BucketName
          );

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

            if (!fileExists || override) {
              // Download from CW and upload to S3
              uploadToS3 = async () => {
                const { writeStream, promise } = uploadStream(s3FileName, doc.content.mimeType);
                await downloadDocumentFromCW({
                  cxId: patient.cxId,
                  patientId: patient.id,
                  facilityId: facilityId,
                  location: docLocation,
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
                const signedUrl = s3Client.getSignedUrl("getObject", {
                  Bucket: s3BucketName,
                  Key: s3FileName,
                });
                const url = new URL(signedUrl);
                const s3Location = url.origin + url.pathname;
                return {
                  bucket: s3BucketName,
                  key: s3FileName,
                  location: s3Location,
                  size: existingSize,
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
            const conversionRequested = await convertCDAToFHIR({
              patient,
              document: { id: fhirDocId, mimeType: doc.content?.mimeType },
              s3FileName: file.key,
              s3BucketName: file.bucket,
            });
            if (conversionRequested) fhirConvertCount++;
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
                total: documents.length,
                successful: completedCount,
                errors: errorCount,
              },
              ...(fhirConvertCount > 0
                ? {
                    convertProgress: {
                      status: "processing",
                      total: fhirConvertCount,
                    },
                  }
                : undefined),
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

async function getFileInfoFromS3(
  key: string,
  bucket: string
): Promise<{ exists: true; size: number } | { exists: false; size?: never }> {
  try {
    const head = await s3Client
      .headObject({
        Bucket: bucket,
        Key: key,
      })
      .promise();
    return { exists: true, size: head.ContentLength ?? 0 };
  } catch (err) {
    return { exists: false };
  }
}

function reportDocQueryUsage(patient: Patient): void {
  reportUsage({
    cxId: patient.cxId,
    entityId: patient.id,
    apiType: ApiTypes.medical,
  });
}

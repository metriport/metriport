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
import { getPatientOrFail } from "../../../command/medical/patient/get-patient";
import { ApiTypes, reportUsage } from "../../../command/usage/report-usage";
import { processPatientDocumentRequest } from "../../../command/webhook/medical";
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
import { makeS3Client } from "../../aws/s3";
import { convertCDAToFHIR } from "../../fhir-converter/converter";
import { toFHIR as toFHIRDocRef } from "../../fhir/document";
import { getDocumentSandboxPayload } from "../../fhir/document/get-documents";
import { upsertDocumentToFHIRServer } from "../../fhir/document/save-document-reference";
import { MAX_FHIR_DOC_ID_LENGTH, postFHIRBundle } from "../../fhir/shared";
import { groupFHIRErrors, tryDetermineFhirError } from "../../fhir/shared/error-mapping";
import { makeCommonWellAPI, organizationQueryMeta } from "../api";
import { groupCWErrors } from "../error-categories";
import { getPatientData, PatientDataCommonwell } from "../patient-shared";
import { downloadDocument } from "./document-download";
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
      // if this is sandbox, just send the sandbox payload to the WH
      const documentsSandbox = getDocumentSandboxPayload(patient.id);
      processPatientDocumentRequest(organization.cxId, patient.id, toDTO(documentsSandbox));
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

      reportDocQuery(patient);

      // send webhook to cx async when docs are done processing
      processPatientDocumentRequest(organization.cxId, patient.id, toDTO(FHIRDocRefs));

      return FHIRDocRefs.length;
    }
  } catch (err) {
    console.log(`Error: `, err);
    capture.error(err, {
      extra: {
        context: `cw.queryDocuments`,
        ...(err instanceof CommonwellError ? err.additionalInfo : undefined),
      },
    });
    throw err;
  } finally {
    try {
      await updateDocQuery({ patient, status: "completed" });
    } catch (err) {
      capture.error(err, {
        extra: { context: `cw.getDocuments.updateDocQuery` },
      });
    }
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
  const { log } = Util.out(`CW internalGetDocuments - M patient ${patient.id}`);

  const externalData = patient.data.externalData?.COMMONWELL;
  if (!externalData) {
    log(`No external data found for patient ${patient.id}, not querying for docs`);
    return [];
  }
  const cwData = externalData as PatientDataCommonwell;

  const orgName = organization.data.name;
  const orgId = organization.id;
  const facilityNPI = facility.data["npi"] as string; // TODO #414 move to strong type - remove `as string`
  const commonWell = makeCommonWellAPI(orgName, oid(orgId));
  const queryMeta = organizationQueryMeta(orgName, { npi: facilityNPI });

  const docs: Document[] = [];
  const cwErrs: OperationOutcome[] = [];
  try {
    const queryResponse = await commonWell.queryDocumentsFull(queryMeta, cwData.patientId);
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
        extra: d.content,
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

  const uploadStream = (s3FileName: string, contentType?: string) => {
    const pass = new PassThrough();
    return {
      writeStream: pass,
      promise: s3Client
        .upload({
          Bucket: Config.getMedicalDocumentsBucketName(),
          Key: s3FileName,
          Body: pass,
          ...(contentType ? { ContentType: contentType } : {}),
        })
        .promise(),
    };
  };

  const downloadStream = (s3FileName: string) => {
    return s3Client
      .getObject({
        Bucket: Config.getMedicalDocumentsBucketName(),
        Key: s3FileName,
      })
      .createReadStream();
  };

  const docsNewLocation: DocumentReference[] = [];
  let completedCount = 0;

  // split the list in chunks
  const chunks = chunk(documents, DOC_DOWNLOAD_CHUNK_SIZE);
  for (const docChunk of chunks) {
    const s3Refs = await Promise.allSettled(
      docChunk.map(async doc => {
        try {
          const fhirDocId = getDocumentPrimaryId(doc);
          // Make this before download and insert on S3 bc of https://metriport.slack.com/archives/C04DBBJSKGB/p1684113732495119?thread_ts=1684105959.041439&cid=C04DBBJSKGB
          if (fhirDocId.length > MAX_FHIR_DOC_ID_LENGTH) {
            throw new MetriportError("FHIR doc ID too long", undefined, { fhirDocId });
          }

          const s3FileName = createS3FileName(patient.cxId, fhirDocId);
          const fileExists = await existsOnS3(s3FileName);

          const docLocation = doc.content.location;
          if (docLocation) {
            // add some randomness to avoid overloading the servers
            await jitterSingleDownload();

            let getS3InfoAndContents: () => Promise<{
              s3Location: string;
              fileContents: Promise<{ contents: string; size: number }>;
            }>;

            if (!fileExists || override) {
              // Download from CW and upload to S3
              getS3InfoAndContents = async () => {
                const { writeStream, promise } = uploadStream(s3FileName, doc.content.mimeType);

                // listen to stream data as it's passed through
                const fileContents = Util.streamToString(writeStream);

                await downloadDocument({
                  cxId: patient.cxId,
                  patientId: patient.id,
                  facilityId: facilityId,
                  location: docLocation,
                  stream: writeStream,
                });

                const data = await promise;
                return { s3Location: data.Location, fileContents };
              };
            } else {
              // Download from S3
              getS3InfoAndContents = async () => {
                const stream = downloadStream(s3FileName);
                const fileContents = Util.streamToString(stream);

                const signedUrl = s3Client.getSignedUrl("getObject", {
                  Bucket: Config.getMedicalDocumentsBucketName(),
                  Key: s3FileName,
                });
                const url = new URL(signedUrl);
                const s3Location = url.origin + url.pathname;

                return { s3Location, fileContents };
              };
            }

            const { s3Location, fileContents } = await getS3InfoAndContents();
            const file = await fileContents;

            const docWithFile: CWDocumentWithMetriportData = {
              ...doc,
              metriport: {
                fileName: s3FileName,
                location: s3Location,
                fileSize: file.size,
              },
            };

            // make sure the doc is XML/CDA before attempting to convert
            if (
              doc.content?.mimeType === "application/xml" ||
              doc.content?.mimeType === "text/xml"
            ) {
              try {
                // note that on purpose, this bundle will not contain the corresponding doc ref
                const fhirBundle = await convertCDAToFHIR(patient.id, fhirDocId, file.contents);
                if (fhirBundle) await postFHIRBundle(patient.cxId, fhirBundle);
              } catch (error) {
                reportFHIRError({ patientId: patient.id, doc, error, log });
              }
            }
            const FHIRDocRef = toFHIRDocRef(fhirDocId, docWithFile, organization, patient);
            await upsertDocumentToFHIRServer(organization.cxId, FHIRDocRef);

            return FHIRDocRef;
          } else {
            log(`Doc without location, skipping - docId ${fhirDocId}, s3FileName ${s3FileName}`);
          }
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
          throw error;
        } finally {
          // TODO: eventually we will have to update this to support multiple HIEs
          try {
            const newPatient = await getPatientOrFail({ id: patient.id, cxId: patient.cxId });

            completedCount = completedCount + 1;

            await updateDocQuery({
              patient: newPatient,
              status: "processing",
              progress: {
                completed: completedCount,
                total: documents.length,
              },
            });
          } catch (err) {
            capture.error(err, {
              extra: { context: `cw.getDocuments.updateDocQuery` },
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

async function existsOnS3(key: string): Promise<boolean> {
  try {
    await s3Client
      .headObject({
        Bucket: Config.getMedicalDocumentsBucketName(),
        Key: key,
      })
      .promise();
    return true;
  } catch (err) {
    return false;
  }
}

function reportDocQuery(patient: Patient): void {
  reportUsage({
    cxId: patient.cxId,
    entityId: patient.id,
    apiType: ApiTypes.medical,
  });
}

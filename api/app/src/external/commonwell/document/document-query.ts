import { DocumentReference } from "@medplum/fhirtypes";
import {
  CommonwellError,
  Document,
  documentReferenceResourceType,
  OperationOutcome,
  operationOutcomeResourceType,
} from "@metriport/commonwell-sdk";
import * as AWS from "aws-sdk";
import { PassThrough } from "stream";
import { updateDocQuery } from "../../../command/medical/document/document-query";
import { getPatientOrFail } from "../../../command/medical/patient/get-patient";
import { ApiTypes, reportUsage } from "../../../command/usage/report-usage";
import { processPatientDocumentRequest } from "../../../command/webhook/medical";
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
import { toFHIR as toFHIRDocRef } from "../../fhir/document";
import { getDocumentSandboxPayload } from "../../fhir/document/get-documents";
import { upsertDocumentToFHIRServer } from "../../fhir/document/save-document-reference";
import { MAX_FHIR_DOC_ID_LENGTH } from "../../fhir/shared";
import { makeCommonWellAPI, organizationQueryMeta } from "../api";
import { getPatientData, PatientDataCommonwell } from "../patient-shared";
import { downloadDocument } from "./document-download";
import { DocumentWithFilename, getFileName } from "./shared";

const s3client = new AWS.S3();

/**
 * This is likely to be a long-running function
 */
export async function queryDocuments({
  patient,
  facilityId,
  override,
}: {
  patient: Patient;
  facilityId: string;
  override?: boolean;
}): Promise<void> {
  const { log } = Util.out(`CW queryDocuments - M patient ${patient.id}`);

  const { organization, facility } = await getPatientData(patient, facilityId);

  try {
    if (Config.isSandbox()) {
      // if this is sandbox, just send the sandbox payload to the WH
      processPatientDocumentRequest(
        organization.cxId,
        patient.id,
        toDTO(getDocumentSandboxPayload(patient.id))
      );
    } else {
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

async function internalGetDocuments({
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
  if (!externalData) return [];
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
    log(`Document query contained errors: ${JSON.stringify(cwErrs)}`);
    capture.message("Document query contained errors", {
      extra: {
        cwReference: commonWell.lastReferenceHeader,
        patientId: patient.id,
        cwErrs: `${JSON.stringify(cwErrs, null, 2)}`,
      },
    });
  }

  log(`Document query got ${docs.length} documents${docs.length ? ", processing" : ""}...`);
  const documents: Document[] = docs.flatMap(d => {
    if (d.content.size === 0) {
      log(`Document is of size 0, skipping - doc id ${d.id}`);
      capture.message("Document is of size 0", {
        extra: d.content,
      });
      return [];
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
        raw: d,
      };
    }
    log(`content, master ID or location not present, skipping - ${JSON.stringify(d)}`);
    return [];
  });

  return documents;
}

async function downloadDocsAndUpsertFHIR({
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

  const uploadStream = (s3FileName: string) => {
    const pass = new PassThrough();

    return {
      writeStream: pass,
      promise: s3client
        .upload({
          Bucket: Config.getMedicalDocumentsBucketName(),
          Key: s3FileName,
          Body: pass,
        })
        .promise(),
    };
  };

  let completedCount = 0;

  const s3Refs = await Promise.allSettled(
    documents.map(async doc => {
      try {
        const primaryId = getDocumentPrimaryId(doc);
        const s3FileName = createS3FileName(patient.cxId, primaryId);

        if (!override) {
          const s3File = await fileExists(s3FileName);
          if (s3File) {
            // TODO remove this once this is working for a few weeks
            log(
              `Doc already exists in S3 and override=false, skipping - ` +
                `docId ${primaryId}, s3FileName ${s3FileName}`
            );
            return;
          }
        } else {
          // TODO remove this once this is working for a few weeks
          log(`override=true, NOT checking whether doc exists - s3FileName ${s3FileName}`);
        }

        if (doc.content.location) {
          // Make this before download and insert on S3 bc of https://metriport.slack.com/archives/C04DBBJSKGB/p1684113732495119?thread_ts=1684105959.041439&cid=C04DBBJSKGB
          const fhirDocId = getDocumentPrimaryId(doc);
          if (fhirDocId.length > MAX_FHIR_DOC_ID_LENGTH) {
            throw new MetriportError("FHIR doc ID too long", undefined, { fhirDocId });
          }

          const { writeStream, promise } = uploadStream(s3FileName);

          await downloadDocument({
            cxId: patient.cxId,
            patientId: patient.id,
            facilityId: facilityId,
            location: doc.content?.location,
            stream: writeStream,
          });

          const data = await promise;

          const docWithFile: DocumentWithFilename = {
            ...doc,
            content: {
              ...doc.content,
              location: data.Location,
            },
            fileName: data.Key,
          };

          const FHIRDocRef = toFHIRDocRef(fhirDocId, docWithFile, organization, patient);
          await upsertDocumentToFHIRServer(organization.cxId, FHIRDocRef);

          return FHIRDocRef;
        } else {
          log(`Doc without location, skipping - docId ${primaryId}, s3FileName ${s3FileName}`);
        }
      } catch (error) {
        log(`Error downloading from CW and upserting to FHIR (docId ${doc.id}): ${error}`);
        capture.error(error, {
          extra: {
            context: `s3.documentUpload`,
            patientId: patient.id,
            documentReference: doc,
            // TODO test/remove if possible
            // couldn't test if this will be automatically visible in Sentry just by sending the error
            // as first param to capture.error
            ...(error instanceof MetriportError ? { additionalInfo: error.additionalInfo } : {}),
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

  const docsNewLocation: DocumentReference[] = s3Refs.flatMap(ref =>
    ref.status === "fulfilled" && ref.value ? ref.value : []
  );

  return docsNewLocation;
}

async function fileExists(key: string): Promise<boolean> {
  try {
    await s3client
      .getObject({
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

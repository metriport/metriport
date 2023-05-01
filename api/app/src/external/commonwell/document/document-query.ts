import {
  CommonwellError,
  Document,
  OperationOutcome,
  documentReferenceResourceType,
  operationOutcomeResourceType,
} from "@metriport/commonwell-sdk";
import { DocumentReference } from "@medplum/fhirtypes";
import { PassThrough } from "stream";
import * as AWS from "aws-sdk";
import { updateDocQuery } from "../../../command/medical/document/document-query";
import { Patient } from "../../../models/medical/patient";
import { Organization } from "../../../models/medical/organization";
import { Facility } from "../../../models/medical/facility";
import { capture } from "../../../shared/notifications";
import { oid } from "../../../shared/oid";
import { Util } from "../../../shared/util";
import { makeCommonWellAPI, organizationQueryMeta } from "../api";
import { getPatientData, PatientDataCommonwell } from "../patient-shared";
import { downloadDocument } from "./document-download";
import { upsertDocumentToFHIRServer } from "../../fhir/document/save-document-reference";
import { toFHIR as toFHIRDocRef } from "../../fhir/document";
import { DocumentWithFilename } from "./shared";
import { Config } from "../../../shared/config";
import { createS3FileName } from "../../../shared/external";
import { getFileName } from "./shared";
import { getPatientOrFail } from "../../../command/medical/patient/get-patient";
import { toDTO } from "../../../routes/medical/dtos/documentDTO";
import { processPatientRequest } from "../../../command/webhook/webhook";

const s3client = new AWS.S3();

/**
 * This is likely to be a long-running function
 */
export async function queryDocuments({
  patient,
  facilityId,
}: {
  patient: Patient;
  facilityId: string;
}): Promise<void> {
  try {
    if (Config.isSandbox()) {
      return;
    }

    const { organization, facility } = await getPatientData(patient, facilityId);

    const cwDocuments = await internalGetDocuments({ patient, organization, facility });

    const FHIRDocRefs = await downloadDocsAndUpsertFHIR({
      patient,
      organization,
      facilityId,
      documents: cwDocuments,
    });

    // send webhook to cx async when docs are done processing
    processPatientRequest(organization.cxId, patient.id, toDTO(FHIRDocRefs));
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
  const { debug } = Util.out(`CW internalGetDocuments - M patient ${patient.id}`);

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
    debug(`resp queryDocuments: ${JSON.stringify(docs, null, 2)}`);

    for (const item of queryResponse.entry) {
      if (item.content?.resourceType === documentReferenceResourceType) {
        docs.push(item as Document);
      } else if (item.content?.resourceType === operationOutcomeResourceType) {
        cwErrs.push(item as OperationOutcome);
      }
    }
  } catch (err) {
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
    capture.message("Document query contained errors", {
      extra: {
        cwReference: commonWell.lastReferenceHeader,
        patientId: patient.id,
        cwErrs,
      },
    });
  }

  const documents: Document[] = docs.flatMap(d => {
    if (d.content.size === 0) {
      capture.message("Document is of size 0", {
        extra: d.content,
      });

      return [];
    }

    if (d.content?.masterIdentifier?.value && d.content && d.content.location) {
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

    return [];
  });

  return documents;
}

async function downloadDocsAndUpsertFHIR({
  patient,
  organization,
  facilityId,
  documents,
}: {
  patient: Patient;
  organization: Organization;
  facilityId: string;
  documents: Document[];
}): Promise<DocumentReference[]> {
  const uploadStream = (key: string) => {
    const pass = new PassThrough();
    const base64key = Buffer.from(key).toString("base64");

    return {
      writeStream: pass,
      promise: s3client
        .upload({
          Bucket: Config.getMedicalDocumentsBucketName(),
          Key: createS3FileName(patient.cxId, base64key),
          Body: pass,
        })
        .promise(),
    };
  };

  let completedCount = 0;

  const s3Refs = await Promise.allSettled(
    documents.map(async doc => {
      try {
        if (doc.content?.masterIdentifier?.value && doc.content.location) {
          const { writeStream, promise } = uploadStream(doc.content.masterIdentifier.value);

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

          const FHIRDocRef = toFHIRDocRef(docWithFile, organization, patient);
          await upsertDocumentToFHIRServer(FHIRDocRef);

          return FHIRDocRef;
        }
      } catch (error) {
        capture.error(error, {
          extra: {
            context: `s3.documentUpload`,
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

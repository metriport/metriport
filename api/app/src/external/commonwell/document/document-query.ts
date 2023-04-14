import { CommonwellError, DocumentQueryResponse, Document } from "@metriport/commonwell-sdk";
import stream from "stream";
import * as AWS from "aws-sdk";
import { updateDocQueryStatus } from "../../../command/medical/document/document-query";
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
import { toFHIR as toFHIRDocRef } from "./shared";
import { DocumentWithFilename } from "./shared";
import { Config } from "../../../shared/config";
import { createS3FileName } from "../../../shared/external";
import { debug } from "../../../shared/log";

const s3client = new AWS.S3();

export async function getDocuments({
  patient,
  facilityId,
}: {
  patient: Patient;
  facilityId: string;
}): Promise<void> {
  try {
    const { organization, facility } = await getPatientData(patient, facilityId);

    const cwDocuments = await internalGetDocuments({ patient, organization, facility });

    if (Config.isSandbox()) {
      return;
    }

    console.log(debug(JSON.stringify(cwDocuments, null, 2)));

    const docsS3Refs = await dowloadAnduploadDocsToS3({
      patient,
      facilityId,
      documents: cwDocuments,
    });

    docsS3Refs.forEach(async doc => {
      const FHIRDocRef = toFHIRDocRef(doc, organization, patient);
      await upsertDocumentToFHIRServer(FHIRDocRef);
    });
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
      await updateDocQueryStatus({ patient, status: "completed" });
    } catch (err) {
      capture.error(err, {
        extra: { context: `cw.getDocuments.updateDocQueryStatus` },
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

  let docs: DocumentQueryResponse;
  try {
    docs = await commonWell.queryDocuments(queryMeta, cwData.patientId);
    debug(`resp queryDocuments: ${JSON.stringify(docs, null, 2)}`);
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

  const documents: Document[] = docs.entry
    ? docs.entry.flatMap(d =>
        d.id && d.content && d.content.location
          ? { id: d.id, content: { location: d.content.location, ...d.content } }
          : []
      )
    : [];
  return documents;
}

async function dowloadAnduploadDocsToS3({
  patient,
  facilityId,
  documents,
}: {
  patient: Patient;
  facilityId: string;
  documents: Document[];
}): Promise<DocumentWithFilename[]> {
  const uploadStream = (key: string) => {
    const pass = new stream.PassThrough();
    const removePeriods = key.split(".").join("");

    return {
      writeStream: pass,
      promise: s3client
        .upload({
          Bucket: Config.getMedicalDocumentsBucketName(),
          Key: createS3FileName(patient.cxId, removePeriods),
          Body: pass,
        })
        .promise(),
    };
  };

  const s3Refs = await Promise.allSettled(
    documents.map(async doc => {
      if (doc.content?.masterIdentifier?.value) {
        const { writeStream, promise } = uploadStream(doc.content?.masterIdentifier?.value);

        await downloadDocument({
          cxId: patient.cxId,
          patientId: patient.id,
          facilityId: facilityId,
          location: doc.content?.location ? doc.content.location : "",
          stream: writeStream,
        });

        const data = await promise;

        return {
          ...doc,
          content: {
            ...doc.content,
            location: data.Location,
          },
          fileName: data.Key,
        };
      }

      return undefined;
    })
  );

  const docsNewLocation: DocumentWithFilename[] = s3Refs.flatMap(ref =>
    ref.status === "fulfilled" && ref.value ? ref.value : []
  );

  s3Refs.forEach(ref => {
    if (ref.status === "rejected") {
      capture.error(ref.reason, {
        extra: {
          context: `s3.documentUpload`,
        },
      });
    }
  });

  return docsNewLocation;
}

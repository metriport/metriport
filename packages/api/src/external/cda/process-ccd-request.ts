import { DocumentReference, Organization } from "@medplum/fhirtypes";
import { CCD_SUFFIX } from "@metriport/core/domain/document/upload";
import { Patient } from "@metriport/core/domain/patient";
import { cdaDocumentUploaderHandler } from "@metriport/core/shareback/cda-uploader";
import { out } from "@metriport/core/util/log";
import { capture } from "@metriport/core/util/notifications";
import { Config } from "../../shared/config";
import { generateCcd } from "./generate-ccd";
import { generateEmptyCcd } from "./generate-empty-ccd";

const medicalBucket = Config.getMedicalDocumentsBucketName();
const awsRegion = Config.getAWSRegion();
const ccdDocRefTemplate: DocumentReference = {
  resourceType: "DocumentReference",
  status: "current",
  type: {
    coding: [
      {
        code: "34133-9",
        display: "SUMMARIZATION OF EPISODE NOTE",
        system: "http://loinc.org",
      },
    ],
  },
  description: "Continuity of Care Document (CCD)",
};

function createDocRef(patientId: string) {
  return { ...ccdDocRefTemplate, subject: { reference: `Patient/${patientId}` } };
}

export async function processCcdRequest(patient: Patient, organization: Organization) {
  const { log } = out(`Generate CCD cxId: ${patient.cxId}, patientId: ${patient.id}`);
  try {
    const ccd = await generateCcd(patient);
    const docRef = createDocRef(patient.id);
    log(`CCD generated. Starting the upload...`);
    await cdaDocumentUploaderHandler({
      cxId: patient.cxId,
      patientId: patient.id,
      bundle: ccd,
      medicalDocumentsBucket: medicalBucket,
      region: awsRegion,
      organization,
      docId: CCD_SUFFIX,
      docRef,
    });
    log(`CCD uploaded into ${medicalBucket}`);
  } catch (error) {
    const msg = `Error creating and uploading CCD`;
    log(`${msg}: error - ${error}`);
    capture.error(msg, { extra: { error, cxId: patient.cxId, patientId: patient.id } });
    throw error;
  }
}

export async function processEmptyCcdRequest(patient: Patient, organization: Organization) {
  const { log } = out(`Generate empty CCD cxId: ${patient.cxId}, patientId: ${patient.id}`);
  try {
    const ccd = await generateEmptyCcd(patient);
    const docRef = createDocRef(patient.id);
    log(`Empty CCD generated. Starting the upload...`);
    await cdaDocumentUploaderHandler({
      cxId: patient.cxId,
      patientId: patient.id,
      bundle: ccd,
      medicalDocumentsBucket: medicalBucket,
      region: awsRegion,
      organization,
      docId: CCD_SUFFIX,
      docRef,
    });
    log(`CCD uploaded into ${medicalBucket}`);
  } catch (error) {
    const msg = `Error creating and uploading empty CCD`;
    log(`${msg}: error - ${error}`);
    capture.error(msg, { extra: { error, cxId: patient.cxId, patientId: patient.id } });
    throw error;
  }
}

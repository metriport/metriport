import { DocumentReference, Organization as FhirOrganization } from "@medplum/fhirtypes";
import { CCD_SUFFIX } from "@metriport/core/domain/document/upload";
import { Organization } from "@metriport/core/domain/organization";
import { Patient } from "@metriport/core/domain/patient";
import { toFHIR as toFhirOrganization } from "@metriport/core/external/fhir/organization/conversion";
import { cdaDocumentUploaderHandler } from "@metriport/core/shareback/cda-uploader";
import { out } from "@metriport/core/util/log";
import { capture } from "@metriport/core/util/notifications";
import { uuidv7 } from "@metriport/core/util/uuid-v7";
import { getOrganizationOrFail } from "../../command/medical/organization/get-organization";
import { Config } from "../../shared/config";
import { generateCcd } from "./generate-ccd";
import { generateEmptyCcd } from "./generate-empty-ccd";
// import { generateCcdLegacy } from "./generate-ccd-legacy";

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

export async function processCcdRequest({
  patient,
  organization: orgParam,
  requestId = uuidv7(),
}: {
  patient: Patient;
  organization?: Organization;
  requestId?: string;
}): Promise<void> {
  const { log } = out(`Generate CCD cx ${patient.cxId} pat ${patient.id}`);
  try {
    const organization = orgParam ?? (await getOrganizationOrFail({ cxId: patient.cxId }));
    const fhirOrg = toFhirOrganization(organization);

    const ccd = await generateCcd(patient, organization, requestId);

    const docRef = createDocRef(patient.id);
    log(`CCD generated. Starting the upload...`);
    await cdaDocumentUploaderHandler({
      cxId: patient.cxId,
      patientId: patient.id,
      bundle: ccd,
      medicalDocumentsBucket: medicalBucket,
      region: awsRegion,
      organization: fhirOrg,
      docId: CCD_SUFFIX,
      docRef,
    });

    // TODO: Remove when done testing ---------
    // const ccdLegacy = await generateCcdLegacy(patient, organization, requestId);
    // const docRef = createDocRef(patient.id);
    // log(`CCD generated. Starting the upload...`);
    // await cdaDocumentUploaderHandler({
    //   cxId: patient.cxId,
    //   patientId: patient.id,
    //   bundle: ccdLegacy,
    //   medicalDocumentsBucket: medicalBucket,
    //   region: awsRegion,
    //   organization: fhirOrg,
    //   docId: `${CCD_SUFFIX}_LEGACY`,
    //   docRef,
    // });
    // ----------------------------------------
    log(`CCD uploaded into ${medicalBucket}`);
  } catch (error) {
    const msg = `Error creating and uploading CCD`;
    log(`${msg}: error - ${error}`);
    capture.error(msg, { extra: { error, cxId: patient.cxId, patientId: patient.id } });
    throw error;
  }
}

export async function processEmptyCcdRequest(patient: Patient, organization: FhirOrganization) {
  const { log } = out(`Generate empty CCD cx ${patient.cxId} pat ${patient.id}`);
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

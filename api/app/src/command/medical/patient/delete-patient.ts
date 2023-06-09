import cwCommands from "../../../external/commonwell";
import { validateVersionForUpdate } from "../../../models/_default";
import { BaseUpdateCmdWithCustomer } from "../base-update-command";
import { getPatientOrFail } from "./get-patient";
import { Config } from "../../../shared/config";
import { makeS3Client } from "../../../external/aws/s3";
import { Patient } from "../../../models/medical/patient";
import { getDocuments } from "../../../external/fhir/document/get-documents";
import { createS3FileName } from "../../../shared/external";
import { makeFhirApi } from "../../../external/fhir/api/api-factory";
import { capture } from "../../../shared/notifications";

export type PatientDeleteCmd = BaseUpdateCmdWithCustomer & {
  facilityId: string;
};

const s3Client = makeS3Client();
const s3BucketName = Config.getMedicalDocumentsBucketName();

export const deletePatient = async (patientDelete: PatientDeleteCmd): Promise<void> => {
  const { id, cxId, facilityId, eTag } = patientDelete;

  const patient = await getPatientOrFail({ id, cxId });
  validateVersionForUpdate(patient, eTag);

  if (Config.isSandbox()) {
    const fhirApi = makeFhirApi(cxId);

    try {
      // TODO: #393 move to declarative, event-based integration
      // Synchronous bc it needs to run after the Patient is deleted (it needs patient data from the DB)
      await cwCommands.patient.remove(patient, facilityId);
      await fhirApi.deleteResource("Patient", patient.id);
      await removeDocsFromS3(patient);
      //eslint-disable-next-line @typescript-eslint/no-explicit-any
    } catch (err: any) {
      capture.error(err, {
        extra: {
          context: `cw.deletePatient`,
          patientId: patient.id,
        },
      });
    }
  }

  await patient.destroy();
};

const removeDocsFromS3 = async (patient: Patient): Promise<void> => {
  const { id, cxId } = patient;
  const documents = await getDocuments({ patientId: id, cxId });

  if (!documents) return;

  for (const document of documents) {
    if (document.id) {
      const documentKey = createS3FileName(patient.cxId, document.id);
      await s3Client.deleteObject({ Bucket: s3BucketName, Key: documentKey }).promise();
    }
  }
};

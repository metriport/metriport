import { getValidPatientsFromFile } from "./commands/validate-and-parse-bulk-upload";
import { checkUploadRecord } from "./commands/check-upload-record";
import { creatOrUpdateUploadRecord } from "./commands/create-or-update-upload-record";
import { createPatient } from "./commands/create-patient";
import { startPatientDiscovery } from "./commands/start-patient-discovery";
import {
  BulkUplaodHandler,
  ProcessFileRequest,
  ProcessPatientCreateRequest,
  ProcessPatientDiscoveryRequest,
} from "./bulk-upload";
import { createPatienPayload } from "./shared";

export class BulkUplaodHandlerDirect implements BulkUplaodHandler {
  async processFile({
    requestId,
    cxId,
    fileName,
    bucket,
    fileType,
  }: ProcessFileRequest): Promise<void> {
    const patients = await getValidPatientsFromFile(fileName, bucket, fileType);
    await Promise.all(
      patients.map(async patient => {
        const patientPayload = createPatienPayload(patient);
        await this.processPatientCreate({
          requestId,
          cxId,
          patientPayload,
          bucket,
        });
      })
    );
  }

  async processPatientCreate({
    requestId,
    cxId,
    patientPayload,
    bucket,
  }: ProcessPatientCreateRequest): Promise<void> {
    const patientId = await createPatient({
      cxId,
      facilityId: "test",
      patient: patientPayload,
    });
    const patientAlreadyProcessed = await checkUploadRecord({
      requestId,
      cxId,
      patientId,
      bucket,
    });
    if (patientAlreadyProcessed) return;
    await creatOrUpdateUploadRecord({
      requestId,
      cxId,
      patientId,
      bucket,
    });
    await this.processPatientDiscovery({
      requestId,
      cxId,
      patientId,
      bucket,
    });
  }

  async processPatientDiscovery({
    requestId,
    cxId,
    patientId,
    bucket,
  }: ProcessPatientDiscoveryRequest) {
    await startPatientDiscovery({
      cxId,
      patientId,
    });
    await creatOrUpdateUploadRecord({
      requestId,
      cxId,
      patientId,
      data: { patientDiscoveryStatus: "processing" },
      bucket,
    });
  }
}

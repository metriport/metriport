import { makeLambdaClient } from "../../external/aws/lambda";
import { SQSClient } from "../../external/aws/sqs";
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
import { Config } from "../../util/config";

const region = Config.getAWSRegion();
const processPatientCreateLambda = Config.getProcessPatientCreateLamda();
const processPatientDiscoveryQueue = Config.getProcessPatientDiscoveryQueueUrl();

const lambdaClient = makeLambdaClient(region);
const sqsClient = new SQSClient({ region });

export class BulkUplaodHandlerLambda implements BulkUplaodHandler {
  async processFile({
    requestId,
    cxId,
    fileName,
    bucket,
    fileType,
  }: ProcessFileRequest): Promise<void> {
    if (!processPatientCreateLambda) throw new Error("Process patient create lambda not setup.");
    const patients = await getValidPatientsFromFile(fileName, bucket, fileType);
    patients.map(patient => {
      const patientPayload = createPatienPayload(patient);
      lambdaClient.invoke({
        FunctionName: processPatientCreateLambda,
        InvocationType: "RequestResponse",
        Payload: JSON.stringify({
          requestId,
          cxId,
          patientPayload,
          bucket,
        }),
      });
    });
  }

  async processPatientCreate({
    requestId,
    cxId,
    patientPayload,
    bucket,
  }: ProcessPatientCreateRequest): Promise<void> {
    if (!processPatientDiscoveryQueue)
      throw new Error("Process patient discovery queue lambda not setup.");
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
    await sqsClient.sendMessageToQueue(
      processPatientDiscoveryQueue,
      JSON.stringify({ requestId, cxId, patientId, bucket }),
      {
        fifo: true,
        messageDeduplicationId: patientId,
        messageGroupId: cxId,
      }
    );
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

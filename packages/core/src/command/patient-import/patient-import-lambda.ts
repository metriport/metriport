import { uuidv4 } from "../../util/uuid-v7";
import { makeLambdaClient } from "../../external/aws/lambda";
import { SQSClient } from "../../external/aws/sqs";
import { getValidPatientsFromImport } from "./commands/validate-and-parse-import";
import { checkUploadRecord } from "./commands/check-upload-record";
import { creatOrUpdateUploadRecord } from "./commands/create-or-update-upload-record";
import { startDocumentQuery } from "./commands/start-document-query";
import { createPatient } from "./commands/create-patient";
import { startPatientDiscovery } from "./commands/start-patient-discovery";
import {
  PatientImportHandler,
  StartImportRequest,
  ProcessFileRequest,
  ProcessPatientCreateRequest,
  ProcessPatientDiscoveryRequest,
} from "./patient-import";
import { createPatientPayload } from "./shared";
import { Config } from "../../util/config";

const region = Config.getAWSRegion();
const startPatientImportLambda = Config.getStartPatientImportLamda();
const processPatientCreateLambda = Config.getProcessPatientCreateLamda();
const processPatientDiscoveryQueue = Config.getProcessPatientDiscoveryQueueUrl();

const lambdaClient = makeLambdaClient(region);
const sqsClient = new SQSClient({ region });

export class PatientImportHandlerLambda implements PatientImportHandler {
  async startImport({ cxId, s3BucketName, s3FileName }: StartImportRequest): Promise<void> {
    if (!startPatientImportLambda) throw new Error("Start patient import lambda not setup.");
    const jobId = uuidv4();
    lambdaClient.invoke({
      FunctionName: startPatientImportLambda,
      InvocationType: "Event",
      Payload: JSON.stringify({
        cxId,
        jobId,
        s3BucketName,
        s3FileName,
      }),
    });
  }

  async processFile({
    cxId,
    jobId,
    s3BucketName,
    s3FileName,
    fileType,
  }: ProcessFileRequest): Promise<void> {
    if (!processPatientCreateLambda) throw new Error("Process patient create lambda not setup.");
    const patients = await getValidPatientsFromImport({ s3BucketName, s3FileName, fileType });
    patients.map(patient => {
      const patientPayload = createPatientPayload(patient);
      const processPatientRequest: ProcessPatientCreateRequest = {
        cxId,
        jobId,
        patientPayload,
        s3BucketName,
      };
      lambdaClient.invoke({
        FunctionName: processPatientCreateLambda,
        InvocationType: "Event",
        Payload: JSON.stringify(processPatientRequest),
      });
    });
  }

  async processPatientCreate({
    cxId,
    jobId,
    patientPayload,
    s3BucketName,
  }: ProcessPatientCreateRequest): Promise<void> {
    if (!processPatientDiscoveryQueue)
      throw new Error("Process patient discovery queue lambda not setup.");
    const patientId = await createPatient({
      cxId,
      patientPayload,
    });
    const patientAlreadyProcessed = await checkUploadRecord({
      cxId,
      jobId,
      patientId,
      s3BucketName,
    });
    if (patientAlreadyProcessed) return;
    await creatOrUpdateUploadRecord({
      cxId,
      jobId,
      patientId,
      s3BucketName,
    });
    await sqsClient.sendMessageToQueue(
      processPatientDiscoveryQueue,
      JSON.stringify({ jobId, cxId, patientId, s3BucketName }),
      {
        fifo: true,
        messageDeduplicationId: patientId,
        messageGroupId: cxId,
      }
    );
  }

  async processPatientDiscovery({
    cxId,
    jobId,
    patientId,
    s3BucketName,
  }: ProcessPatientDiscoveryRequest) {
    await startPatientDiscovery({
      cxId,
      patientId,
    });
    await startDocumentQuery({
      cxId,
      patientId,
    });
    await creatOrUpdateUploadRecord({
      cxId,
      jobId,
      patientId,
      data: { patientDiscoveryStatus: "processing" },
      s3BucketName,
    });
  }
}

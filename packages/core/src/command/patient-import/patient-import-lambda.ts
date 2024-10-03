import { sleep } from "@metriport/shared";
import { uuidv4 } from "../../util/uuid-v7";
import { makeLambdaClient } from "../../external/aws/lambda";
import { SQSClient } from "../../external/aws/sqs";
import { creatUploadHistory } from "./commands/create-upload-history";
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
import { createPatientPayload } from "./patient-import-shared";
import { Config } from "../../util/config";

const region = Config.getAWSRegion();
const patientImportBucket = Config.getPatientImportBucket();
const startPatientImportLambda = Config.getStartPatientImportLamda();
const processPatientCreateLambda = Config.getProcessPatientCreateLamda();
const processPatientDiscoveryQueue = Config.getProcessPatientDiscoveryQueueUrl();

const lambdaClient = makeLambdaClient(region);
const sqsClient = new SQSClient({ region });

export class PatientImportHandlerLambda implements PatientImportHandler {
  async startImport({
    cxId,
    facilityId,
    s3BucketName,
    s3FileName,
    dryrun = false,
    rerunPdOnNewDemographics = true,
  }: StartImportRequest): Promise<void> {
    if (!startPatientImportLambda) throw new Error("Start patient import lambda not setup.");
    if (!patientImportBucket) throw new Error("Patient import bucket not setup.");
    const jobId = uuidv4();
    await creatUploadHistory({
      cxId,
      jobId,
      patientImportBucket,
      s3FileName,
    });
    lambdaClient.invoke({
      FunctionName: startPatientImportLambda,
      InvocationType: "Event",
      Payload: JSON.stringify({
        cxId,
        facilityId,
        jobId,
        s3BucketName,
        s3FileName,
        fileType: "csv", // TODO Parse extension
        dryrun,
        rerunPdOnNewDemographics,
      }),
    });
  }

  async processFile({
    cxId,
    facilityId,
    jobId,
    s3BucketName,
    s3FileName,
    fileType,
    dryrun,
    rerunPdOnNewDemographics,
  }: ProcessFileRequest): Promise<void> {
    if (!processPatientCreateLambda) throw new Error("Process patient create lambda not setup.");
    if (!patientImportBucket) throw new Error("Patient import bucket not setup.");
    const patients = await getValidPatientsFromImport({ s3BucketName, s3FileName, fileType });
    if (dryrun) return;
    patients.map(patient => {
      const patientPayload = createPatientPayload(patient);
      const processPatientCreateRequest: ProcessPatientCreateRequest = {
        cxId,
        facilityId,
        jobId,
        patientPayload,
        patientImportBucket,
        rerunPdOnNewDemographics,
      };
      lambdaClient.invoke({
        FunctionName: processPatientCreateLambda,
        InvocationType: "Event",
        Payload: JSON.stringify(processPatientCreateRequest),
      });
    });
  }

  async processPatientCreate({
    cxId,
    facilityId,
    jobId,
    patientPayload,
    patientImportBucket,
    rerunPdOnNewDemographics,
  }: ProcessPatientCreateRequest): Promise<void> {
    if (!processPatientDiscoveryQueue)
      throw new Error("Process patient discovery queue lambda not setup.");
    const patientId = await createPatient({
      cxId,
      facilityId,
      patientPayload,
    });
    const patientAlreadyProcessed = await checkUploadRecord({
      cxId,
      jobId,
      patientId,
      patientImportBucket,
    });
    if (patientAlreadyProcessed) return;
    await creatOrUpdateUploadRecord({
      cxId,
      jobId,
      patientId,
      patientImportBucket,
    });
    const processPatientDiscoveryRequest: ProcessPatientDiscoveryRequest = {
      cxId,
      jobId,
      patientId,
      patientImportBucket,
      rerunPdOnNewDemographics,
    };
    await sqsClient.sendMessageToQueue(
      processPatientDiscoveryQueue,
      JSON.stringify(processPatientDiscoveryRequest),
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
    patientImportBucket,
    rerunPdOnNewDemographics,
    timeout,
  }: ProcessPatientDiscoveryRequest) {
    await startPatientDiscovery({
      cxId,
      patientId,
      rerunPdOnNewDemographics,
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
      patientImportBucket,
    });
    if (timeout) sleep(timeout);
  }
}

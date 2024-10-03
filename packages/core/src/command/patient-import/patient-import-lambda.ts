import { sleep } from "@metriport/shared";
import { uuidv7 } from "../../util/uuid-v7";
import { makeLambdaClient } from "../../external/aws/lambda";
import { SQSClient } from "../../external/aws/sqs";
import { createJobRecord } from "./commands/create-job-record";
import { validateAndParsePatientImportCsv } from "./commands/validate-and-parse-import";
import { checkPatientRecord } from "./commands/check-patient-record";
import { creatOrUpdatePatientRecord } from "./commands/create-or-update-patient-record";
import { startDocumentQuery } from "./commands/start-document-query";
import { createPatient } from "./commands/create-patient";
import { startPatientQuery } from "./commands/start-patient-query";
import {
  PatientImportHandler,
  StartImportRequest,
  ProcessFileRequest,
  ProcessPatientCreateRequest,
  ProcessPatientQueryRequest,
} from "./patient-import";
import { createPatientPayload } from "./patient-import-shared";
import { Config } from "../../util/config";

const region = Config.getAWSRegion();

const lambdaClient = makeLambdaClient(region);
const sqsClient = new SQSClient({ region });

export class PatientImportHandlerLambda implements PatientImportHandler {
  async startImport({
    cxId,
    facilityId,
    jobId,
    processFileLambda,
    rerunPdOnNewDemographics = true,
    dryrun = false,
  }: StartImportRequest): Promise<void> {
    const processFileRequest: Omit<
      ProcessFileRequest,
      "jobStartedAt" | "s3BucketName" | "processPatientCreateQueue"
    > = {
      cxId,
      facilityId,
      jobId,
      rerunPdOnNewDemographics,
      dryrun,
    };
    lambdaClient.invoke({
      FunctionName: processFileLambda,
      InvocationType: "Event",
      Payload: JSON.stringify(processFileRequest),
    });
  }

  async processFile({
    cxId,
    facilityId,
    jobId,
    jobStartedAt,
    s3BucketName,
    processPatientCreateQueue,
    rerunPdOnNewDemographics,
    dryrun,
  }: ProcessFileRequest): Promise<void> {
    await createJobRecord({
      cxId,
      jobId,
      data: { jobStartedAt },
      s3BucketName,
    });
    const patients = await validateAndParsePatientImportCsv({
      cxId,
      jobId,
      s3BucketName,
    });
    if (dryrun) return;
    patients.map(patient => {
      const patientPayload = createPatientPayload(patient);
      const processPatientCreateRequest: Omit<
        ProcessPatientCreateRequest,
        "s3BucketName" | "processPatientQueryQueue"
      > = {
        cxId,
        facilityId,
        jobId,
        patientPayload,
        rerunPdOnNewDemographics,
      };
      sqsClient.sendMessageToQueue(
        processPatientCreateQueue,
        JSON.stringify(processPatientCreateRequest),
        {
          fifo: true,
          messageDeduplicationId: uuidv7(),
          messageGroupId: cxId,
        }
      );
    });
  }

  async processPatientCreate({
    cxId,
    facilityId,
    jobId,
    patientPayload,
    s3BucketName,
    processPatientQueryQueue,
    rerunPdOnNewDemographics,
  }: ProcessPatientCreateRequest): Promise<void> {
    const patientId = await createPatient({
      cxId,
      facilityId,
      patientPayload,
    });
    const patientAlreadyProcessed = await checkPatientRecord({
      cxId,
      jobId,
      patientId,
      s3BucketName,
    });
    if (patientAlreadyProcessed) return;
    await creatOrUpdatePatientRecord({
      cxId,
      jobId,
      patientId,
      s3BucketName,
    });
    const processPatientQueryRequest: Omit<ProcessPatientQueryRequest, "waitTimeInMillis"> = {
      cxId,
      jobId,
      patientId,
      s3BucketName,
      rerunPdOnNewDemographics,
    };
    sqsClient.sendMessageToQueue(
      processPatientQueryQueue,
      JSON.stringify(processPatientQueryRequest),
      {
        fifo: true,
        messageDeduplicationId: patientId,
        messageGroupId: cxId,
      }
    );
  }

  async processPatientQuery({
    cxId,
    jobId,
    patientId,
    s3BucketName,
    rerunPdOnNewDemographics,
    waitTimeInMillis,
  }: ProcessPatientQueryRequest) {
    await startPatientQuery({
      cxId,
      patientId,
      rerunPdOnNewDemographics,
    });
    await startDocumentQuery({
      cxId,
      patientId,
    });
    await creatOrUpdatePatientRecord({
      cxId,
      jobId,
      patientId,
      data: { patientQueryStatus: "processing" },
      s3BucketName,
    });
    if (waitTimeInMillis > 0) sleep(waitTimeInMillis);
  }
}

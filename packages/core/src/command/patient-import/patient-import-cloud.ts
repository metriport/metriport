import { Duration } from "aws-cdk-lib";
import { chunk } from "lodash";
import { sleep, errorToString } from "@metriport/shared";
import { capture } from "../../util/notifications";
import { out } from "../../util/log";
import { uuidv7 } from "../../util/uuid-v7";
import { makeLambdaClient } from "../../external/aws/lambda";
import { SQSClient } from "../../external/aws/sqs";
import { createJobRecord } from "./commands/create-job-record";
import { validateAndParsePatientImportCsvFromS3 } from "./commands/validate-and-parse-import";
import { checkPatientRecordExists } from "./commands/check-patient-record-exists";
import { creatOrUpdatePatientRecord } from "./commands/create-or-update-patient-record";
import { startDocumentQuery } from "./commands/start-document-query";
import { createPatient } from "./commands/create-patient";
import { startPatientQuery } from "./commands/start-patient-query";
import {
  PatientImportHandler,
  StartPatientImportRequest,
  ProcessPatientImportRequest,
  ProcessPatientCreateRequest,
  ProcessPatientQueryRequest,
} from "./patient-import";
import { createPatientPayload } from "./patient-import-shared";
import { Config } from "../../util/config";

const region = Config.getAWSRegion();

const lambdaClient = makeLambdaClient(region);
const sqsClient = new SQSClient({ region });

// 20 / second -> 18000 in 15min
const sleepBetweenPatientCreateChunks = Duration.millis(250);
const patientCreateChunk = 5;

export type ProcessPatientImportEvemtPayload = Omit<
  ProcessPatientImportRequest,
  "jobStartedAt" | "s3BucketName" | "processPatientCreateQueue"
>;
export type ProcessPatientCreateEvemtPayload = Omit<
  ProcessPatientCreateRequest,
  "s3BucketName" | "processPatientQueryQueue" | "waitTimeInMillis"
>;
export type ProcessPatientQueryEvemtPayload = Omit<
  ProcessPatientQueryRequest,
  "s3BucketName" | "waitTimeInMillis"
>;

export class PatientImportHandlerCloud implements PatientImportHandler {
  async startPatientImport({
    cxId,
    facilityId,
    jobId,
    processPatientImportLambda,
    rerunPdOnNewDemographics = true,
    dryrun = false,
  }: StartPatientImportRequest): Promise<void> {
    const { log } = out(`startPatientImport- cxId ${cxId} jobId ${jobId}`);
    try {
      const processPatientImportRequest: ProcessPatientImportEvemtPayload = {
        cxId,
        facilityId,
        jobId,
        rerunPdOnNewDemographics,
        dryrun,
      };
      try {
        await lambdaClient
          .invoke({
            FunctionName: processPatientImportLambda,
            InvocationType: "Event",
            Payload: JSON.stringify(processPatientImportRequest),
          })
          .promise();
      } catch (error) {
        const msg = `Failure while sending payload to patient import lambda @ PatientImport`;
        log(`${msg}. Cause: ${errorToString(error)}`);
        capture.error(msg, {
          extra: {
            cxId,
            jobId,
            processPatientImportRequest,
            context: "patient-import-cloud.send-payload-to-patient-import-lambda",
            error,
          },
        });
        throw error;
      }
    } catch (error) {
      const msg = `Failure while starting patient import @ PatientImport`;
      log(`${msg}. Cause: ${errorToString(error)}`);
      capture.error(msg, {
        extra: {
          cxId,
          jobId,
          context: "patient-import-cloud.start-patient-import",
          error,
        },
      });
      throw error;
    }
  }

  async processPatientImport({
    cxId,
    facilityId,
    jobId,
    jobStartedAt,
    s3BucketName,
    processPatientCreateQueue,
    rerunPdOnNewDemographics,
    dryrun,
  }: ProcessPatientImportRequest): Promise<void> {
    const { log } = out(`processPatientImport - cxId ${cxId} jobId ${jobId}`);
    try {
      await createJobRecord({
        cxId,
        jobId,
        jobStartedAt,
        data: { jobStartedAt },
        s3BucketName,
      });
      const patients = await validateAndParsePatientImportCsvFromS3({
        cxId,
        jobId,
        jobStartedAt,
        s3BucketName,
      });
      if (dryrun) {
        log(`Dryrun is true, returning...`);
        return;
      }
      const allOutcomes: PromiseSettledResult<void>[] = [];
      const patientChunks = chunk(patients, patientCreateChunk);
      for (const patientChunk of patientChunks) {
        const chunkOutcomes = await Promise.allSettled(
          patientChunk.map(async patient => {
            const patientPayload = createPatientPayload(patient);
            const processPatientCreateRequest: ProcessPatientCreateEvemtPayload = {
              cxId,
              facilityId,
              jobId,
              jobStartedAt,
              patientPayload,
              rerunPdOnNewDemographics,
            };
            try {
              await sqsClient.sendMessageToQueue(
                processPatientCreateQueue,
                JSON.stringify(processPatientCreateRequest),
                {
                  fifo: true,
                  messageDeduplicationId: uuidv7(),
                  messageGroupId: cxId,
                }
              );
            } catch (error) {
              const msg = `Failure while sending payload to patient create queue @ PatientImport`;
              log(`${msg}. Cause: ${errorToString(error)}`);
              capture.error(msg, {
                extra: {
                  cxId,
                  jobId,
                  processPatientCreateRequest,
                  context: "patient-import-cloud.send-payload-to-patient-create-queue",
                  error,
                },
              });
              throw error;
            }
          })
        );
        allOutcomes.push(...chunkOutcomes);
        await sleep(sleepBetweenPatientCreateChunks.toMilliseconds());
      }
      const hadFailure = allOutcomes.some(outcome => outcome.status === "rejected");
      if (hadFailure) throw new Error("At least one payload failed to send to create queue");
    } catch (error) {
      const msg = `Failure while processing patient import @ PatientImport`;
      log(`${msg}. Cause: ${errorToString(error)}`);
      capture.error(msg, {
        extra: {
          cxId,
          jobId,
          context: "patient-import-cloud.process-patient-import",
          error,
        },
      });
      throw error;
    }
  }

  async processPatientCreate({
    cxId,
    facilityId,
    jobId,
    jobStartedAt,
    patientPayload,
    s3BucketName,
    processPatientQueryQueue,
    rerunPdOnNewDemographics,
    waitTimeInMillis,
  }: ProcessPatientCreateRequest): Promise<void> {
    const { log } = out(`processPatientCreate - cxId ${cxId} jobId ${jobId}`);
    try {
      const patientId = await createPatient({
        cxId,
        facilityId,
        patientPayload,
      });
      const recordExists = await checkPatientRecordExists({
        cxId,
        jobId,
        jobStartedAt,
        patientId,
        s3BucketName,
      });
      if (recordExists) {
        log(`Record exists for patientId ${patientId}, returning...`);
        return;
      }
      await creatOrUpdatePatientRecord({
        cxId,
        jobId,
        jobStartedAt,
        patientId,
        s3BucketName,
      });
      const processPatientQueryRequest: ProcessPatientQueryEvemtPayload = {
        cxId,
        jobId,
        jobStartedAt,
        patientId,
        rerunPdOnNewDemographics,
      };
      try {
        await sqsClient.sendMessageToQueue(
          processPatientQueryQueue,
          JSON.stringify(processPatientQueryRequest),
          {
            fifo: true,
            messageDeduplicationId: patientId,
            messageGroupId: cxId,
          }
        );
      } catch (error) {
        const msg = `Failure while sending payload to patient query queue @ PatientImport`;
        log(`${msg}. Cause: ${errorToString(error)}`);
        capture.error(msg, {
          extra: {
            cxId,
            jobId,
            patientId,
            processPatientQueryRequest,
            context: "patient-import-cloud.send-payload-to-patient-query-queue",
            error,
          },
        });
        throw error;
      }
      if (waitTimeInMillis > 0) await sleep(waitTimeInMillis);
    } catch (error) {
      const msg = `Failure while processing patient create @ PatientImport`;
      log(`${msg}. Cause: ${errorToString(error)}`);
      capture.error(msg, {
        extra: {
          cxId,
          jobId,
          context: "patient-import-cloud.process-patient-create",
          error,
        },
      });
      throw error;
    }
  }

  async processPatientQuery({
    cxId,
    jobId,
    jobStartedAt,
    patientId,
    s3BucketName,
    rerunPdOnNewDemographics,
    waitTimeInMillis,
  }: ProcessPatientQueryRequest) {
    const { log } = out(
      `PprocessPatientQuery - cxId ${cxId} jobId ${jobId} patientId ${patientId}`
    );
    try {
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
        jobStartedAt,
        patientId,
        data: { patientQueryStatus: "processing" },
        s3BucketName,
      });
      if (waitTimeInMillis > 0) await sleep(waitTimeInMillis);
    } catch (error) {
      const msg = `Failure while processing patient query @ PatientImport`;
      log(`${msg}. Cause: ${errorToString(error)}`);
      capture.error(msg, {
        extra: {
          cxId,
          jobId,
          patientId,
          context: "patient-import-cloud.process-patient-query",
          error,
        },
      });
      throw error;
    }
  }
}

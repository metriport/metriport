import { fetchJobRecordOrFail } from "@metriport/core/command/patient-import/record/fetch-job-record";
import { PatientImportParseRequest } from "@metriport/core/command/patient-import/steps/parse/patient-import-parse";
import { PatientImportParseCloud } from "@metriport/core/command/patient-import/steps/parse/patient-import-parse-cloud";
import { S3Utils } from "@metriport/core/external/aws/s3";
import { sendToSlack } from "@metriport/core/external/slack/index";
import { Config } from "@metriport/core/util/config";
import { errorToString } from "@metriport/shared";
import * as Sentry from "@sentry/serverless";
import { S3Event } from "aws-lambda";
import { capture } from "./shared/capture";
import { getEnvOrFail } from "./shared/env";

// Keep this as early on the file as possible
capture.init();

const region = getEnvOrFail("AWS_REGION");
const slackNotificationUrl = getEnvOrFail("SLACK_NOTIFICATION_URL");
const patientImportParseLambdaName = getEnvOrFail("PATIENT_IMPORT_PARSE_LAMBDA_NAME");
const isSandbox = Config.isSandbox();

export async function handler(event: S3Event) {
  try {
    for (const record of event.Records) {
      const sourceBucket = record.s3.bucket.name;
      const sourceKey = decodeURIComponent(record.s3.object.key);
      console.log(
        "Running the bulk import upload notification with sourceBucket:",
        sourceBucket,
        "sourceKey:",
        sourceKey
      );
      try {
        const s3Utils = new S3Utils(region);
        const { metadata } = await s3Utils.getFileInfoFromS3(sourceBucket, sourceKey);
        const isDev = metadata && metadata["isDev"] === "true";

        // e.g.: patient-import/cxid=<UUID>/date=2025-01-01/jobid=<UUID>/files/raw.csv
        const sourceParts = sourceKey.split("/");
        const cxId = sourceParts.find(s => s.startsWith("cxid="))?.split("=")[1];
        const jobId = sourceParts.find(s => s.startsWith("jobid="))?.split("=")[1];
        if (!cxId || !jobId) {
          throw new Error(
            `Missing cxId or jobId in sourceKey ${sourceKey} - cxId: ${cxId}, jobId: ${jobId}`
          );
        }
        const jobRecord = await fetchJobRecordOrFail({ cxId, jobId });
        const { triggerConsolidated, disableWebhooks, rerunPdOnNewDemographics, dryRun } =
          jobRecord.params;

        const subjectSuffix = isSandbox
          ? " - :package: `SANDBOX` :package:"
          : isDev
          ? " - :nerd_face: `Dev` :nerd_face:"
          : "";
        const msgPrefix = isDev ? "[:warning: To continue, call the internal endpoint]\n" : "";
        await sendToSlack(
          {
            subject: `New bulk patient import initiated` + subjectSuffix,
            message:
              msgPrefix +
              `Customer: ${cxId}\nJob ID: ${jobId}\nS3 bucket: ${sourceBucket}\nS3 key (file): ${sourceKey}`,
            emoji: ":info:",
          },
          slackNotificationUrl
        );

        if (!isDev) {
          console.log(`Calling the parse lambda`);
          const parseCloud = new PatientImportParseCloud(patientImportParseLambdaName);
          const payload: PatientImportParseRequest = {
            cxId,
            jobId,
            triggerConsolidated,
            disableWebhooks,
            rerunPdOnNewDemographics,
            dryRun,
          };
          await parseCloud.processJobParse(payload);
        }
      } catch (error) {
        const msg = `Error processing new patient import file`;
        console.log(msg, sourceKey, errorToString(error));
        capture.error(msg, {
          extra: { context: `patient-import-upload-notification`, sourceBucket, sourceKey, error },
        });
      }
    }
  } finally {
    await Sentry.close();
  }
}

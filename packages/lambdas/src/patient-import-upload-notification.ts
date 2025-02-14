import { sendToSlack } from "@metriport/core/external/slack/index";
import { Config } from "@metriport/core/util/config";
import { errorToString } from "@metriport/shared";
import * as Sentry from "@sentry/serverless";
import { S3Event } from "aws-lambda";
import { capture } from "./shared/capture";
import { getEnvOrFail } from "./shared/env";

// Keep this as early on the file as possible
capture.init();

const slackNotificationUrl = getEnvOrFail("SLACK_NOTIFICATION_URL");
const isSandbox = Config.isSandbox();

export async function handler(event: S3Event) {
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
      // e.g.: patient-import/cxid=<UUID>/date=2025-01-01/jobid=<UUID>/files/raw.csv
      const cxId = sourceKey
        .split("/")
        .find(s => s.startsWith("cxid="))
        ?.split("=")[1];
      const subjectSuffix = isSandbox ? " - :package: `SANDBOX` :package: " : "";
      await sendToSlack(
        {
          subject: `New bulk patient import initiated` + subjectSuffix,
          message: `Customer: ${cxId}\nS3 bucket: ${sourceBucket}\nS3 key (file): ${sourceKey}`,
          emoji: ":warning:",
        },
        slackNotificationUrl
      );
    } catch (error) {
      const msg = `Error processing new patient import file`;
      console.log(msg, sourceKey, errorToString(error));
      capture.error(msg, {
        extra: { context: `patient-import-upload-notification`, sourceBucket, sourceKey, error },
      });
    }
  }
  await Sentry.close();
}

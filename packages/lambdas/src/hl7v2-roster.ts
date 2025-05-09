import { Hl7v2RosterGenerator } from "@metriport/core/command/hl7v2-subscriptions/hl7v2-roster-generator";
import * as Sentry from "@sentry/serverless";
import { uploadThroughSftp } from "@metriport/core/command/hl7v2-subscriptions/hl7v2-roster-uploader";
import { HieConfig } from "@metriport/core/command/hl7v2-subscriptions/types";
import { getEnvOrFail } from "./shared/env";

const apiUrl = getEnvOrFail("API_URL");
const bucketName = getEnvOrFail("BUCKET_NAME");

export const handler = Sentry.AWSLambda.wrapHandler(async (config: HieConfig): Promise<void> => {
  const rosterCsv = await new Hl7v2RosterGenerator(apiUrl, bucketName).execute(config);
  if (rosterCsv) {
    await uploadThroughSftp(config, rosterCsv);
  }
});

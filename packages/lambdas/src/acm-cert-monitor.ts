import { checkExpiringCertificates } from "@metriport/core/external/aws/acm-cert-monitor";
import * as Sentry from "@sentry/serverless";
import { capture } from "./shared/capture";

// Keep this as early on the file as possible
capture.init();

/**
 * Lambda function that handles ACM Certificate Approaching Expiration events
 * and sends events to Slack.
 */
export const handler = Sentry.AWSLambda.wrapHandler(async () => {
  console.log(`Calling checkExpiringCertificates()...`);

  await checkExpiringCertificates();

  console.log(`Done.`);
});

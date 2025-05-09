import { checkExpiringCertificates } from "@metriport/core/external/aws/acm-cert-monitor";
import { sendHeartbeatToMonitoringService } from "@metriport/core/external/monitoring/heartbeat";
import { getEnvVarOrFail } from "@metriport/shared";
import * as Sentry from "@sentry/serverless";
import { capture } from "./shared/capture";

// Keep this as early on the file as possible
capture.init();

const heartbeatUrl = getEnvVarOrFail("HEARTBEAT_URL");
const notificationUrl = getEnvVarOrFail("SLACK_NOTIFICATION_URL");

/**
 * Lambda function that handles ACM Certificate Approaching Expiration events
 * and sends events to Slack.
 */
export const handler = Sentry.AWSLambda.wrapHandler(async () => {
  console.log(`Calling checkExpiringCertificates()...`);

  await checkExpiringCertificates(notificationUrl);

  await sendHeartbeatToMonitoringService(heartbeatUrl);

  console.log(`Done.`);
});

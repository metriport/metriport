import * as dotenv from "dotenv";
dotenv.config();
// keep that ^ on top
import { checkExpiringCertificates } from "@metriport/core/external/aws/acm-cert-monitor";
import { getEnvVarOrFail } from "@metriport/shared";

/**
 * Check ACM certificates for expiring certificates and send notifications to Slack.
 *
 * Usage:
 * - set the AWS_REGION and SLACK_NOTIFICATION_URL environment variables
 * - run the script
 *   ts-node src/aws/acm/check-certs.ts
 */
async function main() {
  const notificationUrl = getEnvVarOrFail("SLACK_NOTIFICATION_URL");
  await checkExpiringCertificates(notificationUrl);
}

main();

import * as dotenv from "dotenv";
dotenv.config();
// keep that ^ on top
import { checkExpiringCertificates } from "@metriport/core/external/aws/acm-cert-monitor";

/**
 * Check ACM certificates for expiring certificates and send notifications to Slack.
 *
 * Usage:
 * - set the AWS_REGION environment variable
 * - run the script
 *   ts-node src/aws/acm/check-certs.ts
 */
async function main() {
  await checkExpiringCertificates();
}

main();

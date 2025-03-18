import { buildDayjs } from "@metriport/shared/common/date";
import { DeepUndefinable } from "ts-essentials";
import { Config } from "../../util/config";
import { out } from "../../util/log";
import { sendNotification } from "../slack/index";
import { AcmUtils } from "./acm";

const daysToAlarm = 10;
const daysToWarn = 30;

type ExpiringCertificate = {
  arn: string;
  domain: string;
  daysToExpiry: number;
  status: string;
};

/**
 * Checks for expiring certificates and sends notifications to Slack.
 */
export async function checkExpiringCertificates(): Promise<void> {
  const { log } = out(`checkExpiringCertificates`);

  const certificatesMissingData: DeepUndefinable<ExpiringCertificate>[] = [];
  const certificatesExpired: ExpiringCertificate[] = [];
  const certificatesToAlarm: ExpiringCertificate[] = [];
  const certificatesToWarn: ExpiringCertificate[] = [];

  const acmUtils = new AcmUtils(Config.getAWSRegion());
  const importedCerts = await acmUtils.listCertificates({ type: "IMPORTED" });

  for (const cert of importedCerts) {
    const { CertificateArn: arn, DomainName: domain, NotAfter: notAfter, Status: status } = cert;
    if (!arn || !domain || !notAfter || !status) {
      certificatesMissingData.push({
        arn,
        domain,
        daysToExpiry: undefined,
        status,
      });
      continue;
    }
    const daysToExpiry = calculateDaysToExpiry(notAfter);
    if (daysToExpiry < 1 || status === "EXPIRED") {
      certificatesExpired.push({
        arn,
        domain,
        daysToExpiry,
        status,
      });
    } else if (daysToExpiry < daysToAlarm) {
      certificatesToAlarm.push({
        arn,
        domain,
        daysToExpiry,
        status,
      });
    } else if (daysToExpiry < daysToWarn) {
      certificatesToWarn.push({
        arn,
        domain,
        daysToExpiry,
        status,
      });
    }
  }

  if (
    certificatesMissingData.length < 1 &&
    certificatesExpired.length < 1 &&
    certificatesToAlarm.length < 1 &&
    certificatesToWarn.length < 1
  ) {
    log(`No certificates approaching expiration :relieved:`);
    return;
  }

  const certsMissingDataAsString =
    certificatesMissingData.map(c => `- ${JSON.stringify(c)}`).join("\n") ?? "";
  const certsMissingDataMessage = certsMissingDataAsString
    ? `--- MISSING DATA ---\n${certsMissingDataAsString}\n\n`
    : "";

  const certsExpiredAsString = certificatesExpired.map(certToMessage).join("\n");
  const certsExpiredMessage = certsExpiredAsString
    ? `--- EXPIRED CERTIFICATES ---\n${certsExpiredAsString}\n\n`
    : "";

  const certsToAlarmAsString = certificatesToAlarm.map(certToMessage).join("\n");
  const certsToAlarmMessage = certsToAlarmAsString
    ? `IMMINENT EXPIRATION!\n${certsToAlarmAsString}\n\n`
    : "";

  const certsToWarnAsString = certificatesToWarn.map(certToMessage).join("\n");
  const certsToWarnMessage = certsToWarnAsString
    ? `Expiring soon:\n${certsToWarnAsString}\n\n`
    : "";

  const subject = `ACM Certificates approaching expiration`;
  const message = (
    certsMissingDataMessage +
    certsExpiredMessage +
    certsToAlarmMessage +
    certsToWarnMessage
  ).trim();

  log(`${subject}\n${message}`);

  sendNotification({ emoji: ":eyes:", subject, message });
}

function certToMessage(cert: ExpiringCertificate): string {
  const expireStr = cert.daysToExpiry < 0 ? "expired for" : "expires in";
  return (
    `- ${cert.domain} | ${expireStr} ${Math.abs(cert.daysToExpiry)} days ` +
    `| ${cert.status} | ${cert.arn}`
  );
}

function calculateDaysToExpiry(expirationDate: Date): number {
  return buildDayjs(expirationDate).diff(buildDayjs(), "days");
}

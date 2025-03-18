import { ACM, DescribeCertificateCommandOutput } from "@aws-sdk/client-acm";
import { MetriportError } from "@metriport/shared";
import { buildDayjs } from "@metriport/shared/common/date";
import { getEnvVarOrFail } from "@metriport/shared/common/env-var";
import * as Sentry from "@sentry/serverless";
import { EventBridgeEvent } from "aws-lambda";
import { capture } from "./shared/capture";

// Keep this as early on the file as possible
capture.init();

const region = getEnvVarOrFail("AWS_REGION");

const acm = new ACM({ region });

/**
 * Lambda function that handles ACM Certificate Approaching Expiration events
 * and sends events to Sentry.
 *
 * @see https://docs.aws.amazon.com/acm/latest/userguide/supported-events.html#expiration-approaching-event
 */
export const handler = Sentry.AWSLambda.wrapHandler(async function (
  event: EventBridgeEvent<"ACM Certificate Approaching Expiration", { resources: string[] }>
) {
  try {
    console.log(`Running with event: ${JSON.stringify(event)}`);
    if (event.resources.length > 1) {
      console.log(`More than one certificate found in event: ${JSON.stringify(event.resources)}`);
      return {
        statusCode: 500,
        body: JSON.stringify({ message: "More than one certificate found in event" }),
      };
    }
    const certArn = event.resources[0];
    if (!certArn) {
      console.log("No certificate ARN found in event");
      return {
        statusCode: 400,
        body: JSON.stringify({ message: "No certificate ARN found in event" }),
      };
    }

    const certDetails = await getCertificateDetails(certArn);
    if (!certDetails.Certificate) {
      console.log("Certificate not found");
      return {
        statusCode: 400,
        body: JSON.stringify({ message: "Certificate not found" }),
      };
    }

    const {
      DomainName: domain,
      CertificateArn: arn,
      Type: type,
      Status: status,
      NotAfter: notAfter,
    } = certDetails.Certificate;
    if (!notAfter) {
      console.log("Certificate expiration date not found");
      return {
        statusCode: 500,
        body: JSON.stringify({ message: "Certificate expiration date not found" }),
      };
    }

    if (type !== "IMPORTED") {
      const msg = "Certificate is not an imported certificate";
      console.log(`${msg} (ARN: ${arn}, type: ${type})`);
      return {
        statusCode: 200,
        body: JSON.stringify({ message: msg }),
      };
    }

    const daysToExpiry = calculateDaysToExpiry(notAfter);
    const message = `ACM Certificate approaching expiration`;
    const extra = {
      domain,
      arn,
      type,
      status,
      notAfter,
      daysToExpiry,
    };
    console.log(`${message} ${JSON.stringify(extra)}`);
    capture.message(message, {
      extra,
      level: "warning",
    });

    return {
      statusCode: 200,
      body: JSON.stringify({
        message: `Processed expiring certificate for ${domain ?? certArn}`,
      }),
    };
  } catch (error) {
    Sentry.setExtras({ event });
    throw new MetriportError("Failed to process ACM certificate event", error);
  }
});

async function getCertificateDetails(
  certificateArn: string
): Promise<DescribeCertificateCommandOutput> {
  return acm.describeCertificate({ CertificateArn: certificateArn });
}

function calculateDaysToExpiry(expirationDate: Date): number {
  return buildDayjs().diff(buildDayjs(expirationDate), "days");
}

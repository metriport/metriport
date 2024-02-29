import { PollOutboundResults } from "@metriport/core/external/carequality/ihe-gateway/outbound-result-poller";
import { OutboundResultPollerDirect } from "@metriport/core/external/carequality/ihe-gateway/outbound-result-poller-direct";
import { getEnvType, getEnvVar, getEnvVarOrFail } from "@metriport/core/util/env-var";
import { errorToString } from "@metriport/core/util/error/shared";
import { getSecretValueOrFail } from "@metriport/core/external/aws/secret-manager";
import * as Sentry from "@sentry/serverless";
import { capture } from "./shared/capture";

// Keep this as early on the file as possible
capture.init();

const lambdaName = getEnvVar("AWS_LAMBDA_FUNCTION_NAME");
const dbCredsArn = getEnvVarOrFail("DB_CREDS");
const apiUrl = getEnvVarOrFail("API_URL");
const region = getEnvVarOrFail("AWS_REGION");
const maxPollingDuration = getEnvVarOrFail("MAX_POLLING_DURATION");

capture.setExtra({ lambdaName: lambdaName });

export const handler = Sentry.AWSLambda.wrapHandler(
  async ({ requestId, numOfGateways, patientId, cxId }: PollOutboundResults) => {
    console.log(
      `Running with envType: ${getEnvType()}, requestId: ${requestId}, ` +
        `numOfGateways: ${numOfGateways} cxId: ${cxId} patientId: ${patientId}`
    );
    try {
      const dbCreds = await getSecretValueOrFail(dbCredsArn, region);

      const poller = new OutboundResultPollerDirect(apiUrl, dbCreds);
      await poller.pollOutboundDocRetrievalResults({
        requestId,
        patientId,
        cxId,
        numOfGateways,
        maxPollingDuration: parseInt(maxPollingDuration),
      });
    } catch (error) {
      const msg = `Error sending document retrieval results`;
      console.log(`${msg}: ${errorToString(error)}`);
      capture.error(msg, {
        extra: {
          context: `lambda.ihe-outbound-document-retrieval`,
          error,
          patientId,
          requestId,
          cxId,
        },
      });
    }
  }
);

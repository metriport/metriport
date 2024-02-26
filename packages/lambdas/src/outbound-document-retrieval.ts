import { pollOutboundDRResults } from "@metriport/core/external/carequality/ihe-gateway/poll-outbound-results";
import { getEnvType, getEnvVar, getEnvVarOrFail } from "@metriport/core/util/env-var";
import { errorToString } from "@metriport/core/util/error/shared";
import * as Sentry from "@sentry/serverless";
import axios from "axios";
import { capture } from "./shared/capture";

// Keep this as early on the file as possible
capture.init();

const lambdaName = getEnvVar("AWS_LAMBDA_FUNCTION_NAME");
const dbCreds = getEnvVarOrFail("DB_CREDS");
const apiUrl = getEnvVarOrFail("API_URL");
const api = axios.create();
const endpointUrl = `${apiUrl}/internal/carequality/document-retrieval/results`;

capture.setExtra({ lambdaName: lambdaName });

export const handler = Sentry.AWSLambda.wrapHandler(
  async ({
    requestId,
    numOfGateways,
    patientId,
    cxId,
  }: {
    requestId: string;
    numOfGateways: number;
    patientId: string;
    cxId: string;
  }) => {
    console.log(
      `Running with envType: ${getEnvType()}, requestId: ${requestId}, numOfGateways: ${numOfGateways} cxId: ${cxId} patientId: ${patientId}`
    );

    try {
      const results = await pollOutboundDRResults({
        requestId,
        patientId,
        cxId,
        numOfGateways,
        dbCreds,
        endpointUrl,
      });
      console.log(`Sending to API: ${JSON.stringify(results)}`);
      await api.post(endpointUrl, {
        requestId,
        patientId,
        cxId,
        results,
      });
    } catch (error) {
      const msg = `Error sending document retrieval results`;
      console.log(`${msg}: ${errorToString(error)}`);
      capture.error(msg, {
        extra: {
          context: `lambda.outbound-document-retrieval`,
          error,
          patientId,
          requestId,
          cxId,
        },
      });
    }
  }
);

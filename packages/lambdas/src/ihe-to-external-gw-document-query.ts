import * as Sentry from "@sentry/serverless";
import axios from "axios";
import { pollIHEGatewayResults } from "@metriport/core/external/carequality/command/documents/send-ihe-gateway-results";
import {
  DOC_QUERY_RESULT_TABLE_NAME,
  IHEToExternalGwDocumentQuery,
} from "@metriport/core/external/carequality/ihe-result";
import { getEnvVarOrFail, getEnvVar, getEnvType } from "@metriport/core/util/env-var";
import { capture } from "./shared/capture";
import { errorToString } from "@metriport/core/util/error/shared";

// Keep this as early on the file as possible
capture.init();

const lambdaName = getEnvVar("AWS_LAMBDA_FUNCTION_NAME");
const dbCreds = getEnvVarOrFail("DB_CREDS");
const apiUrl = getEnvVarOrFail("API_URL");
const api = axios.create();
const endpointUrl = `${apiUrl}/internal/carequality/document-query/results`;

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
      const results = await pollIHEGatewayResults<IHEToExternalGwDocumentQuery>({
        requestId,
        patientId,
        cxId,
        numOfGateways,
        dbCreds,
        endpointUrl,
        resultsTable: DOC_QUERY_RESULT_TABLE_NAME,
      });

      const resultsData = results.map(result => result.data);

      await api.post(endpointUrl, {
        requestId,
        patientId,
        cxId,
        resultsData,
      });
    } catch (error) {
      const msg = `Error sending document query results`;
      console.log(`${msg}: ${errorToString(error)}`);
      capture.error(error, {
        extra: { context: `sendIHEToExternalGwDocumentQuerys`, error, patientId, requestId, cxId },
      });
    }
  }
);

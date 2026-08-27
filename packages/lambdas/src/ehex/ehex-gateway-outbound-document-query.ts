import { DqRequestGatewayParams } from "@metriport/core/external/ehex/ehex-gateway/outbound/ehex-gateway";
import { createSignSendProcessDqRequests } from "@metriport/core/external/ehex/ehex-gateway/outbound/ehex-gateway-logic";
import { getEnvType, getEnvVarOrFail } from "@metriport/core/util/env-var";
import { out } from "@metriport/core/util/log";
import { Context } from "aws-lambda";
import { capture } from "../shared/capture";
import { getEhexSamlCertsAndKeys } from "./secrets";

capture.init();

const { log } = out("ehex-gateway-outbound-DQ");
const apiUrl = getEnvVarOrFail("API_URL");
const documentQueryResponseUrl = `${apiUrl}/internal/ehex/document-query/response`;

export const handler = capture.wrapHandler(
  async ({ patientId, cxId, requestId, dqRequests }: DqRequestGatewayParams, context: Context) => {
    log(
      `Running with envType: ${getEnvType()}, requestId: ${requestId}, ` +
        `numOfGateways: ${dqRequests.length} cxId: ${cxId} patientId: ${patientId}`
    );
    const invocationId = context.awsRequestId;

    const samlCertsAndKeys = await getEhexSamlCertsAndKeys();
    await createSignSendProcessDqRequests({
      appInstanceId: invocationId,
      dqResponseUrl: documentQueryResponseUrl,
      dqRequests,
      samlCertsAndKeys,
      patientId,
      cxId,
    });
  }
);

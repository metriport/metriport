import { DrRequestGatewayParams } from "@metriport/core/external/ehex/ehex-gateway/outbound/ehex-gateway";
import { createSignSendProcessDrRequests } from "@metriport/core/external/ehex/ehex-gateway/outbound/ehex-gateway-logic";
import { getEnvType, getEnvVarOrFail } from "@metriport/core/util/env-var";
import { out } from "@metriport/core/util/log";
import { Context } from "aws-lambda";
import { capture } from "../shared/capture";
import { getEhexSamlCertsAndKeys } from "./secrets";

capture.init();

const { log } = out("ehex-gateway-outbound-DR");
const apiUrl = getEnvVarOrFail("API_URL");
const drResponseUrl = `${apiUrl}/internal/ehex/document-retrieval/response`;

export const handler = capture.wrapHandler(
  async ({ patientId, cxId, requestId, drRequests }: DrRequestGatewayParams, context: Context) => {
    log(
      `Running with envType: ${getEnvType()}, requestId: ${requestId}, ` +
        `numOfGateways: ${drRequests.length} cxId: ${cxId} patientId: ${patientId}`
    );
    const invocationId = context.awsRequestId;

    const samlCertsAndKeys = await getEhexSamlCertsAndKeys();

    await createSignSendProcessDrRequests({
      appInstanceId: invocationId,
      drResponseUrl,
      drRequests,
      samlCertsAndKeys,
      patientId,
      cxId,
    });
  }
);

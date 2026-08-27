import {
  DocumentReference,
  InboundDocumentRetrievalReq,
  InboundDocumentRetrievalResp,
} from "@metriport/ihe-gateway-sdk";
import { BadRequestError, errorToString, toArray } from "@metriport/shared";
import { buildDayjs } from "@metriport/shared/common/date";
import { createXMLParser } from "@metriport/shared/common/xml-parser";
import {
  NetworkAccessPointTypeCode,
  UNDEFINED_HTTP_STATUS_CODE,
} from "../../../../../../audit-log/types";
import { Config } from "../../../../../../util/config";
import { out } from "../../../../../../util/log";
import { stripUrnPrefix } from "../../../../../../util/urn";
import { getClientAddressFromHeader } from "../../../../../aws/api-gw";
import { processInboundDr } from "../../../../dr/process-inbound-dr";
import { safeStoreInboundDrReqRespJson, safeStoreInboundDrRequest } from "../../../monitor/store";
import {
  convertSoapResponseToMtomResponse,
  getBoundaryFromMtomResponse,
  MtomAttachments,
  parseMtomResponse,
} from "../../../outbound/xca/mtom/parser";
import { extractText } from "../../../utils";
import { auditDrSafe } from "../../ehex-gateway-inbound-auditing";
import {
  convertSamlHeaderToAttributes,
  extractTimestamp,
  parseAndValidateSamlSignature,
} from "../../shared";
import { createInboundDrResponse } from "../create/dr-response";
import { DocumentRequest, iti39RequestSchema } from "./schema";

function extractDocumentReferences(documentRequest: DocumentRequest[]): DocumentReference[] {
  return documentRequest.map(req => ({
    homeCommunityId: stripUrnPrefix(req.HomeCommunityId),
    docUniqueId: stripUrnPrefix(req.DocumentUniqueId),
    repositoryUniqueId: stripUrnPrefix(req.RepositoryUniqueId),
  }));
}

function parseAndValidateInboundDrRequest(request: string): InboundDocumentRetrievalReq {
  const log = out("Inbound DR Request").log;

  try {
    const parser = createXMLParser({
      ignoreAttributes: false,
      attributeNamePrefix: "_",
      textNodeName: "_text",
      parseAttributeValue: false,
      removeNSPrefix: true,
    });
    const jsonObj = parser.parse(request);
    const iti39Request = iti39RequestSchema.parse(jsonObj);
    parseAndValidateSamlSignature(request, iti39Request, log);

    const samlAttributes = convertSamlHeaderToAttributes(iti39Request.Envelope.Header);
    const documentRequests = toArray(
      iti39Request.Envelope.Body.RetrieveDocumentSetRequest.DocumentRequest
    );
    const documentReference = extractDocumentReferences(documentRequests);
    const inboundRequest = {
      id: stripUrnPrefix(extractText(iti39Request.Envelope.Header.MessageID)),
      timestamp: extractTimestamp(iti39Request.Envelope.Header),
      samlAttributes,
      documentReference,
      signatureConfirmation: extractText(
        iti39Request.Envelope.Header.Security.Signature.SignatureValue
      ),
    };

    return inboundRequest;
  } catch (error) {
    const msg = "Failed to parse ITI-39 request";
    const errorAsString = errorToString(error);
    log(`${msg}: Error - ${errorAsString}`);
    throw new BadRequestError(msg, error, { errorAsString });
  }
}

export async function processInboundDrRequest({
  appInstanceId,
  body,
  isBase64Encoded,
  headers,
}: {
  appInstanceId: string;
  body: string;
  isBase64Encoded: boolean;
  headers?: Record<string, string | undefined>;
}): Promise<{ statusCode: number; payload: Buffer; contentType: string }> {
  const { log } = out(`processInboundDrRequest`);
  let result: InboundDocumentRetrievalResp | undefined;
  let statusCode = UNDEFINED_HTTP_STATUS_CODE;
  let outcomeDesc: string | undefined;
  const startTime = buildDayjs().toDate();
  const isDebugModeActive = Config.isDebugModeEnabled();
  isDebugModeActive && log("body: ", body);

  const contentType = headers?.["content-type"] ?? headers?.["Content-Type"];
  const boundary = getBoundaryFromMtomResponse(contentType);
  let mtomParts: MtomAttachments;
  const bodyBuffer = isBase64Encoded ? Buffer.from(body, "base64") : Buffer.from(body);
  if (boundary) {
    mtomParts = await parseMtomResponse(bodyBuffer, boundary);
  } else {
    mtomParts = convertSoapResponseToMtomResponse(bodyBuffer);
  }
  log(`Amount of mtom parts: ${mtomParts.parts.length}`);
  const soapData = mtomParts.parts[0]?.body || Buffer.from("");
  const drRequest: InboundDocumentRetrievalReq = parseAndValidateInboundDrRequest(
    soapData.toString()
  );

  isDebugModeActive && log("drRequest: ", JSON.stringify(drRequest));
  await safeStoreInboundDrRequest({
    request: soapData.toString(),
    inboundRequest: drRequest,
  });

  const clientAddress = getClientAddressFromHeader(headers);
  const initiatorAddress = clientAddress
    ? {
        type: NetworkAccessPointTypeCode.IpAddress,
        address: clientAddress,
      }
    : undefined;

  try {
    result = await processInboundDr(drRequest);
    const response = await createInboundDrResponse(result);
    if (isDebugModeActive) {
      log("result: ", JSON.stringify(result));
      await safeStoreInboundDrReqRespJson({
        inboundRequest: drRequest,
        inboundResponse: result,
      });
    }

    statusCode = 200;
    return { statusCode, payload: response.payload, contentType: response.contentType };
  } catch (error) {
    outcomeDesc = errorToString(error, { detailed: true });
    if (error instanceof BadRequestError) {
      statusCode = 400;
      log(`Client error: ${outcomeDesc}`);
    } else {
      statusCode = 500;
      log(`Server error: ${outcomeDesc}`);
    }
    throw error;
  } finally {
    await auditDrSafe({
      appInstanceId,
      initiatorAddress,
      request: drRequest,
      response: result,
      startTime,
      statusCode,
      outcomeDesc,
    });
  }
}

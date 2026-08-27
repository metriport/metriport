import {
  InboundDocumentQueryResp,
  InboundSpecificDocumentQueryReq,
  ON_DEMAND_DOCUMENT_TYPE_UUID,
  STABLE_DOCUMENT_TYPE_UUID,
  XCPDPatientId,
} from "@metriport/ihe-gateway-sdk";
import { RequestedDocumentType } from "@metriport/ihe-gateway-sdk/models/document-query/document-query-requests";
import { BadRequestError, errorToString, MetriportError, toArray } from "@metriport/shared";
import { buildDayjs } from "@metriport/shared/common/date";
import { createXMLParser } from "@metriport/shared/common/xml-parser";
import {
  NetworkAccessPointTypeCode,
  UNDEFINED_HTTP_STATUS_CODE,
} from "../../../../../../audit-log/types";
import { ensureCcdExists } from "../../../../../../shareback/ensure-ccd-exists";
import { getMetadataDocumentContents } from "../../../../../../shareback/metadata/get-metadata-xml";
import { Config } from "../../../../../../util/config";
import { out } from "../../../../../../util/log";
import { stripUrnPrefix } from "../../../../../../util/urn";
import { getClientAddressFromHeader } from "../../../../../aws/api-gw";
import { decodePatientId } from "../../../../dq/utils";
import { constructDQErrorResponse, IHEGatewayError, XDSRegistryError } from "../../../../error";
import { validateBasePayload } from "../../../../shared";
import { safeStoreInboundDqReqRespJson, safeStoreInboundDqRequest } from "../../../monitor/store";
import { documentEntryTypeSlotName, Slot } from "../../../schema";
import { extractText, getAdhocQueryRequestFromIti38RequestXml, getSlotValue } from "../../../utils";
import { auditDqSafe } from "../../ehex-gateway-inbound-auditing";
import {
  convertSamlHeaderToAttributes,
  extractTimestamp,
  parseAndValidateSamlSignature,
} from "../../shared";
import { createInboundDqResponse } from "../create/dq-response";
import { iti38RequestSchema } from "./schema";

const externalGatewayPatientRegex = /(.+)\^\^\^(.+)/i;
const externalGatewayIdRegex = /'/g;
const externalGatewaySystemRegex = /&|ISO'/g;

export async function processInboundDqRequest({
  appInstanceId,
  body,
  headers,
}: {
  appInstanceId: string;
  body: string;
  headers?: Record<string, string | undefined>;
}): Promise<{ statusCode: number; payload: string }> {
  const { log } = out(`ehex-processInboundDqRequest`);
  let result: InboundDocumentQueryResp | undefined;
  let statusCode = UNDEFINED_HTTP_STATUS_CODE;
  let outcomeDesc: string | undefined;
  const startTime = buildDayjs().toDate();
  const isDebugModeActive = Config.isDebugModeEnabled();
  isDebugModeActive && log("body: ", body);

  const { request, rawQueryInXml } = parseAndValidateInboundDqRequest(body);

  isDebugModeActive && log("dqRequest: ", JSON.stringify(request));
  await safeStoreInboundDqRequest({
    requestXml: body,
    inboundRequest: request,
  });

  const clientAddress = getClientAddressFromHeader(headers);
  const initiatorAddress = clientAddress
    ? {
        type: NetworkAccessPointTypeCode.IpAddress,
        address: clientAddress,
      }
    : undefined;
  try {
    result = await processInboundDq(request);
    const xmlResponse = createInboundDqResponse(result);
    if (isDebugModeActive) {
      log("result: ", JSON.stringify(result));
      await safeStoreInboundDqReqRespJson({
        inboundRequest: request,
        inboundResponse: result,
      });
      log("xmlResponse: ", xmlResponse);
    }

    statusCode = 200;
    return { statusCode, payload: xmlResponse };
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
    await auditDqSafe({
      appInstanceId,
      initiatorAddress,
      query: rawQueryInXml,
      request,
      response: result,
      startTime,
      statusCode,
      outcomeDesc,
    });
  }
}

function extractExternalGatewayPatient(slots: Slot[]): XCPDPatientId {
  const slot = slots.find((slot: Slot) => slot._name === "$XDSDocumentEntryPatientId");
  const value = getSlotValue(slot);
  const match = value?.match(externalGatewayPatientRegex);
  const externalGatewayPatient = match && match[1]?.replace(externalGatewayIdRegex, "");
  const system = match && match[2]?.replace(externalGatewaySystemRegex, "");
  if (!externalGatewayPatient) {
    throw new MetriportError("Failed to extract external gateway patient id");
  }
  return {
    id: externalGatewayPatient,
    system: system ?? "",
  };
}

function parseAndValidateInboundDqRequest(request: string): {
  request: InboundSpecificDocumentQueryReq;
  rawQueryInXml: string;
} {
  const log = out("Inbound DQ Request").log;
  const parser = createXMLParser({
    ignoreAttributes: false,
    attributeNamePrefix: "_",
    textNodeName: "_text",
    parseAttributeValue: false,
    removeNSPrefix: true,
  });
  try {
    const jsonObj = parser.parse(request);
    const iti38Request = iti38RequestSchema.parse(jsonObj);
    parseAndValidateSamlSignature(request, iti38Request, log);

    // Extract the original AdhocQueryRequest XML for audit purposes (required for ATNA compliance)
    // This preserves the exact original XML (attribute order, whitespace, namespace prefixes)
    const queryRaw = getAdhocQueryRequestFromIti38RequestXml(request);

    const samlAttributes = convertSamlHeaderToAttributes(iti38Request.Envelope.Header);
    const slots = toArray(iti38Request.Envelope.Body.AdhocQueryRequest.AdhocQuery.Slot);
    const externalGatewayPatient = extractExternalGatewayPatient(slots);
    const documentTypeSlot = slots.find(slot => slot._name === documentEntryTypeSlotName);
    const documentType = getDocumentType(documentTypeSlot);
    const inboundRequest = {
      id: stripUrnPrefix(extractText(iti38Request.Envelope.Header.MessageID)),
      timestamp: extractTimestamp(iti38Request.Envelope.Header),
      samlAttributes,
      externalGatewayPatient,
      signatureConfirmation: extractText(
        iti38Request.Envelope.Header.Security.Signature.SignatureValue
      ),
      documentType,
    };

    return { request: inboundRequest, rawQueryInXml: queryRaw };
  } catch (error) {
    const msg = "Failed to parse ITI-38 request";
    const errorAsString = errorToString(error);
    log(`${msg}: Error - ${errorAsString}`);
    throw new BadRequestError(msg, error, { errorAsString });
  }
}

function getDocumentType(documentTypeSlot: Slot | undefined): RequestedDocumentType[] {
  const documentTypeString = getSlotValue(documentTypeSlot);
  if (!documentTypeString) return [ON_DEMAND_DOCUMENT_TYPE_UUID, STABLE_DOCUMENT_TYPE_UUID];

  if (
    documentTypeString.includes(STABLE_DOCUMENT_TYPE_UUID) &&
    documentTypeString.includes(ON_DEMAND_DOCUMENT_TYPE_UUID)
  ) {
    return [ON_DEMAND_DOCUMENT_TYPE_UUID, STABLE_DOCUMENT_TYPE_UUID];
  } else if (documentTypeString.includes(STABLE_DOCUMENT_TYPE_UUID)) {
    return [STABLE_DOCUMENT_TYPE_UUID];
  } else if (documentTypeString.includes(ON_DEMAND_DOCUMENT_TYPE_UUID)) {
    return [ON_DEMAND_DOCUMENT_TYPE_UUID];
  }

  return [ON_DEMAND_DOCUMENT_TYPE_UUID, STABLE_DOCUMENT_TYPE_UUID];
}

export async function processInboundDq(
  dqRequest: InboundSpecificDocumentQueryReq
): Promise<InboundDocumentQueryResp> {
  try {
    validateBasePayload(dqRequest);

    const idPair = decodePatientId(dqRequest.externalGatewayPatient.id);
    const { cxId, patientId } = idPair;
    const { log } = out(`Inbound DQ: ${cxId}, patientId: ${patientId}`);

    await ensureCcdExists({ cxId, patientId, log });

    const metadataDocumentContents = await getMetadataDocumentContents(
      cxId,
      patientId,
      dqRequest.documentType
    );
    const response: InboundDocumentQueryResp = {
      id: dqRequest.id,
      patientId,
      timestamp: dqRequest.timestamp,
      responseTimestamp: buildDayjs().toISOString(),
      extrinsicObjectXmls: metadataDocumentContents,
      signatureConfirmation: dqRequest.signatureConfirmation,
    };
    return response;
  } catch (error) {
    if (error instanceof IHEGatewayError) {
      return constructDQErrorResponse(dqRequest, error);
    } else {
      return constructDQErrorResponse(
        dqRequest,
        new XDSRegistryError("Internal Server Error", error)
      );
    }
  }
}

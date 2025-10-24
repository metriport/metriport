import { InboundDocumentQueryReq, XCPDPatientId } from "@metriport/ihe-gateway-sdk";
import { errorToString, toArray } from "@metriport/shared";
import { createXMLParser } from "@metriport/shared/common/xml-parser";
import { stripUrnPrefix } from "../../../../../../util/urn";
import { storeDqRequest } from "../../../monitor/store";
import { Slot } from "../../../schema";
import { extractText } from "../../../utils";
import {
  convertSamlHeaderToAttributes,
  extractTimestamp,
  validateDelegatedRequest,
} from "../../shared";
import { iti38RequestSchema } from "./schema";
import { out } from "../../../../../../util/log";
import { getSlotValue } from "../../../utils";

const externalGatewayPatientRegex = /(.+)\^\^\^(.+)/i;
const externalGatewayIdRegex = /'/g;
const externalGatewaySystemRegex = /&|ISO'/g;

function extractExternalGatewayPatient(slots: Slot[]): XCPDPatientId {
  const slot = slots.find((slot: Slot) => slot._name === "$XDSDocumentEntryPatientId");
  const value = getSlotValue(slot);
  const match = value?.match(externalGatewayPatientRegex);
  const externalGatewayPatient = match && match[1]?.replace(externalGatewayIdRegex, "");
  const system = match && match[2]?.replace(externalGatewaySystemRegex, "");
  if (!externalGatewayPatient) {
    throw new Error("Failed to extract external gateway patient id");
  }
  return {
    id: externalGatewayPatient,
    system: system ?? "",
  };
}

export async function processInboundDqRequest(request: string): Promise<InboundDocumentQueryReq> {
  const log = out("Inbound DQ Request").log;
  log(request);
  try {
    const parser = createXMLParser({
      ignoreAttributes: false,
      attributeNamePrefix: "_",
      textNodeName: "_text",
      parseAttributeValue: false,
      removeNSPrefix: true,
    });
    const jsonObj = parser.parse(request);
    const iti38Request = iti38RequestSchema.parse(jsonObj);
    const samlAttributes = convertSamlHeaderToAttributes(iti38Request.Envelope.Header);
    const slots = toArray(iti38Request.Envelope.Body.AdhocQueryRequest.AdhocQuery.Slot);
    const externalGatewayPatient = extractExternalGatewayPatient(slots);
    const inboundRequest = {
      id: stripUrnPrefix(extractText(iti38Request.Envelope.Header.MessageID)),
      timestamp: extractTimestamp(iti38Request.Envelope.Header),
      samlAttributes,
      externalGatewayPatient,
      signatureConfirmation: extractText(
        iti38Request.Envelope.Header.Security.Signature.SignatureValue
      ),
    };
    await storeDqRequest({ request, inboundRequest });
    if (samlAttributes.principalOid) {
      log(
        `Validating delegated request: principal - ${samlAttributes.principalOid}, delegate -${samlAttributes.homeCommunityId}`
      );
      await validateDelegatedRequest(samlAttributes.principalOid, samlAttributes.homeCommunityId);
      log("Successfully validated");
    }
    return inboundRequest;
  } catch (error) {
    const msg = "Failed to parse ITI-38 request";
    log(`${msg}: Error - ${errorToString(error)}`);
    throw new Error(`${msg}: ${error}`);
  }
}

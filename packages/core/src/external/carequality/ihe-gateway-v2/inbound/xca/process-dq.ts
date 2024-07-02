import { XMLParser } from "fast-xml-parser";
import { toArray } from "@metriport/shared";
import { InboundDocumentQueryReq, XCPDPatientId } from "@metriport/ihe-gateway-sdk";
import { iti38RequestSchema } from "./schema";
import { convertSamlHeaderToAttributes, extractTimestamp } from "../shared";
import { extractText } from "../../utils";
import { Slot } from "../../schema";

const regex = /(.+)\^\^\^(.+)/i;

function extractExternalGatewayPatient(slots: Slot[]): XCPDPatientId {
  const slot = slots.find((slot: Slot) => slot._name === "XDSDocumentEntryPatientId");
  const value = String(slot?.ValueList.Value);
  const match = value.match(regex);
  const externalGatewayPatient = match && match[1];
  const system = match && match[2];
  return {
    id: externalGatewayPatient ?? "",
    system: system ?? "",
  };
}

export function processDqRequest(request: string): InboundDocumentQueryReq {
  const parser = new XMLParser({
    ignoreAttributes: false,
    attributeNamePrefix: "_",
    textNodeName: "_text",
    parseAttributeValue: false,
    removeNSPrefix: true,
  });
  const jsonObj = parser.parse(request);
  try {
    const iti38Request = iti38RequestSchema.parse(jsonObj);
    const samlAttributes = convertSamlHeaderToAttributes(iti38Request.Envelope.Header);
    const slots = toArray(iti38Request.Envelope.Body.AdhocQueryRequest.AdhocQuery.Slot);
    const externalGatewayPatient = extractExternalGatewayPatient(slots);

    return {
      id: extractText(iti38Request.Envelope.Header.MessageID),
      timestamp: extractTimestamp(iti38Request.Envelope.Header),
      samlAttributes,
      externalGatewayPatient,
      signatureConfirmation: extractText(
        iti38Request.Envelope.Header.Security.Signature.SignatureValue
      ),
    };
  } catch (error) {
    console.log(error);
    throw new Error(`Failed to parse ITI-38 request: ${error}`);
  }
}

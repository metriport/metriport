import { XMLBuilder, XMLParser } from "fast-xml-parser";
import { InboundDocumentQueryResp } from "@metriport/ihe-gateway-sdk";
import { namespaces } from "../../constants";
import { createSecurityHeader } from "../shared";

const successStatus = "urn:oasis:names:tc:ebxml-regrep:ResponseStatusType:Success";
const attributeNamePrefix = "@_";

function createIti38SoapBody(response: InboundDocumentQueryResp): object {
  const parser = new XMLParser({
    ignoreAttributes: false,
    attributeNamePrefix: attributeNamePrefix,
    textNodeName: "_text",
    parseAttributeValue: false,
    removeNSPrefix: true,
  });
  const extrinsicObjects = (response?.extrinsicObjectXmls || []).map(xml => ({
    ...parser.parse(xml),
  }));

  const soapBody = {
    "@_xmlns": namespaces.urn,
    "@_xmlns:xsi": namespaces.xsi,
    AdhocQueryResponse: {
      "@_xmlns": namespaces.urn,
      "@_status": successStatus,
      RegistryObjectList: {
        "@_xmlns": namespaces.urn2,
        ExtrinsicObject: extrinsicObjects.map(obj => ({
          ...obj.ExtrinsicObject,
        })),
      },
    },
  };
  return soapBody;
}

export function createIti38SoapEnvelopeInboundResponse(response: InboundDocumentQueryResp): string {
  const securityHeader = createSecurityHeader({
    signatureConfirmation: response.signatureConfirmation,
  });
  const soapBody = createIti38SoapBody(response);

  const soapEnvelope = {
    "soap:Envelope": {
      "@_xmlns:soap": namespaces.soap,
      "@_xmlns:wsa": namespaces.wsa,
      "soap:Header": {
        ...securityHeader,
        "wsa:Action": {
          "#text": "urn:ihe:iti:2007:CrossGatewayQueryResponse",
          "@_mustUnderstand": "1",
        },
        "wsa:RelatesTo": response.id,
      },
      "soap:Body": soapBody,
    },
  };

  const options = {
    format: false,
    attributeNamePrefix: attributeNamePrefix,
    ignoreAttributes: false,
    suppressEmptyNode: true,
    declaration: {
      include: true,
      encoding: "UTF-8",
      version: "1.0",
    },
  };

  const builder = new XMLBuilder(options);
  const xmlContent = builder.build(soapEnvelope);
  return xmlContent;
}

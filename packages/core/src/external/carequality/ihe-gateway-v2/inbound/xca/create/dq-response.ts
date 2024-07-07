import { XMLBuilder, XMLParser } from "fast-xml-parser";
import { v4 as uuidv4 } from "uuid";
import { InboundDocumentQueryResp } from "@metriport/ihe-gateway-sdk";
import { namespaces } from "../../../constants";
import { createSecurityHeader } from "../../shared";
import { successStatus, failureStatus, errorSeverity, attributeNamePrefix } from "../../shared";
import { wrapIdInUrnUuid } from "../../../../../../util/urn";

function createIti38SoapBody(response: InboundDocumentQueryResp): object {
  const parser = new XMLParser({
    ignoreAttributes: false,
    attributeNamePrefix: attributeNamePrefix,
    textNodeName: "_text",
    parseAttributeValue: false,
    removeNSPrefix: true,
  });
  const success = response?.extrinsicObjectXmls ? true : false;
  const extrinsicObjects = success
    ? (response?.extrinsicObjectXmls || []).map(xml => ({
        ...parser.parse(xml),
      }))
    : undefined;
  const registryErrors = !success
    ? (response?.operationOutcome?.issue || []).map(issue => ({
        "@_codeContext": issue.details.text,
        "@_errorCode": issue.details?.coding?.[0]?.code,
        "@_severity": errorSeverity,
      }))
    : undefined;

  const soapBody = {
    "@_xmlns": namespaces.urn,
    "@_xmlns:xsd": namespaces.xs,
    "@_xmlns:xsi": namespaces.xsi,
    AdhocQueryResponse: {
      "@_xmlns": namespaces.urn,
      "@_status": success ? successStatus : failureStatus,
      RegistryObjectList: {
        "@_xmlns": namespaces.urn2,
        ...(extrinsicObjects && {
          ExtrinsicObject: extrinsicObjects.map(obj => ({
            ...obj.ExtrinsicObject,
          })),
        }),
      },
      ...(registryErrors && {
        RegistryErrorList: {
          RegistryError: registryErrors.map(error => ({
            ...error,
          })),
        },
      }),
    },
  };
  return soapBody;
}

export function createInboundDqResponse(response: InboundDocumentQueryResp): string {
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
        "wsa:MessageID": wrapIdInUrnUuid(uuidv4()), // TODO track this
        "wsa:RelatesTo": wrapIdInUrnUuid(response.id),
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

import { XMLBuilder } from "fast-xml-parser";
import dayjs from "dayjs";
import { InboundPatientDiscoveryResp } from "@metriport/ihe-gateway-sdk";
import { namespaces, expiresIn } from "../../constants";
// match
// no match
// error

// need the original messageId of the request
// need to return the security confirmation in the header.
// need to construct the query params again. Might need the InboundPatientDiscoveryReq to do that.
// focus on body for now

export function createSecurityHeader({
  signatureConfirmation,
}: {
  signatureConfirmation?: string | undefined;
}) {
  const createdTimestamp = dayjs().toISOString();
  const expiresTimestamp = dayjs(createdTimestamp).add(expiresIn, "minute").toISOString();
  const securityHeader = {
    "wsse:Security": {
      "@_xmlns:wsse": namespaces.wsse,
      "@_xmlns:ds": namespaces.ds,
      "@_xmlns:wsu": namespaces.wsu,
      "wsu:Timestamp": {
        "wsu:Created": createdTimestamp,
        "wsu:Expires": expiresTimestamp,
      },
      SignatureConfirmation: {
        "@_xmlns": namespaces.wss,
        SignatureValue: signatureConfirmation,
      },
    },
  };
  return securityHeader;
}

export function createIti55SoapEnvelope(response: InboundPatientDiscoveryResp): string {
  const securityHeader = createSecurityHeader({
    signatureConfirmation: response.signatureConfirmation,
  });

  const soapEnvelope = {
    "soap:Envelope": {
      "@_xmlns:soap": namespaces.soap,
      "soap:Header": {
        ...securityHeader,
        "wsa:Action": {
          "#text": "urn:hl7-org:v3:PRPA_IN201306UV02:CrossGatewayPatientDiscovery",
          "@_mustUnderstand": "1",
        },
        "wsa:RelatesTo": response.id,
      },
    },
  };

  const options = {
    format: false,
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

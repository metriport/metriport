import { XMLParser, XMLBuilder } from "fast-xml-parser";
import {
  securityHeaderEnvelopedId,
  stripPemCertificate,
  extractPublicKeyInfo,
} from "./security-header";

const referenceId = "90d3e138-63a6-47f9-884e-881dd10110ca";
const namespaces = {
  ds: "http://www.w3.org/2000/09/xmldsig#",
};

export function insertKeyInfo({
  xmlContent,
  publicCert,
}: {
  xmlContent: string;
  publicCert: string;
}): string {
  const parser = new XMLParser({
    ignoreAttributes: false,
    attributeNamePrefix: "@_",
    parseAttributeValue: false,
  });
  const builder = new XMLBuilder({
    ignoreAttributes: false,
    format: false,
  });

  const obj = parser.parse(xmlContent);
  const security = obj["soap:Envelope"]["soap:Header"]["wsse:Security"];

  const certPemStripped = stripPemCertificate(publicCert);
  const [modulusB64, exponentB64] = extractPublicKeyInfo(certPemStripped);

  if (security && security["saml2:Assertion"]["ds:Signature"]) {
    const keyInfoStructure = {
      "@_xmlns:ds": namespaces.ds,
      "ds:KeyInfo": {
        "ds:KeyValue": {
          "ds:RSAKeyValue": {
            "ds:Modulus": {
              "#text": modulusB64,
            },
            "ds:Exponent": {
              "#text": exponentB64,
            },
          },
        },
        "ds:X509Data": {
          "ds:X509Certificate": {
            "#text": certPemStripped,
          },
        },
      },
    };

    security["saml2:Assertion"]["ds:Signature"] = {
      ...security["saml2:Assertion"]["ds:Signature"],
      ...keyInfoStructure,
    };
  }
  if (security && security["ds:Signature"]) {
    const keyInfoStructure = {
      "ds:KeyInfo": {
        "wsse:SecurityTokenReference": {
          "@_xmlns:wsse11": "http://docs.oasis-open.org/wss/oasis-wss-wssecurity-secext-1.1.xsd",
          "@_wsse11:TokenType":
            "http://docs.oasis-open.org/wss/oasis-wss-saml-token-profile-1.1#SAMLV2.0",
          "@_wsu:Id": referenceId,
          "wsse:KeyIdentifier": {
            "@_ValueType": "http://docs.oasis-open.org/wss/oasis-wss-saml-token-profile-1.1#SAMLID",
            "#text": securityHeaderEnvelopedId,
          },
        },
      },
    };

    security["ds:Signature"] = {
      ...security["ds:Signature"],
      ...keyInfoStructure,
    };
  }
  return builder.build(obj);
}

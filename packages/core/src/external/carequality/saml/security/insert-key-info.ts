import { XMLParser, XMLBuilder } from "fast-xml-parser";
import {
  security_header_enveloped_id,
  stripPemCertificate,
  extractPublicKeyInfo,
} from "./security-header";

export function insertKeyInfo(xmlContent: string, x509CertPem: string): string {
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

  const cert_pem_stripped = stripPemCertificate(x509CertPem);
  const [modulus_b64, exponent_b64] = extractPublicKeyInfo(cert_pem_stripped);

  if (security && security["saml2:Assertion"]["ds:Signature"]) {
    console.log("fixing first signature");
    const keyInfoStructure = {
      "@_xmlns:ds": "http://www.w3.org/2000/09/xmldsig#",
      "ds:KeyInfo": {
        "ds:KeyValue": {
          "ds:RSAKeyValue": {
            "ds:Modulus": {
              "#text": modulus_b64,
            },
            "ds:Exponent": {
              "#text": exponent_b64,
            },
          },
        },
        "ds:X509Data": {
          "ds:X509Certificate": {
            "#text": cert_pem_stripped,
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
          "@_xmlns:ns0": "http://docs.oasis-open.org/wss/oasis-wss-wssecurity-secext-1.1.xsd",
          "@_ns0:TokenType":
            "http://docs.oasis-open.org/wss/oasis-wss-saml-token-profile-1.1#SAMLV2.0",
          "@_wsu:Id": "90d3e138-63a6-47f9-884e-881dd10110ca",
          "wsse:KeyIdentifier": {
            "@_ValueType": "http://docs.oasis-open.org/wss/oasis-wss-saml-token-profile-1.1#SAMLID",
            "#text": security_header_enveloped_id,
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

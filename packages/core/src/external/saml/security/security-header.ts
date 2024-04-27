import * as pkijs from "pkijs";
import * as asn1js from "asn1js";
import { arrayBufferToString, toBase64 } from "pvutils";
import { SNOMED_CODE, NHIN_PURPOSE_CODE_SYSTEM } from "../../carequality/shared";
import { namespaces } from "../constants";
import { wrapIdInUrnOid } from "../utils";

const BEGIN_CERTIFICATE_REGEX = /-----BEGIN CERTIFICATE-----\r?\n/;
const END_CERTIFICATE_REGEX = /-----END CERTIFICATE-----\r?\n?$/;
const NEWLINE_REGEX = /\r?\n/g;

export const securityHeaderTimestampId = "TS-7c229e85-d62b-471e-9112-a49d1c365004";
export const securityHeaderEnvelopedId = "TS_3e57269d-075d-4d3f-9f5d-c97ad6afc009";

export function createSecurityHeader({
  publicCert,
  createdTimestamp,
  expiresTimestamp,
  toUrl,
  subjectRole,
  metriportOrganization,
  homeCommunityId,
  purposeOfUse,
}: {
  publicCert: string;
  createdTimestamp: string;
  expiresTimestamp: string;
  toUrl: string;
  subjectRole: string;
  metriportOrganization: string;
  homeCommunityId: string;
  purposeOfUse: string;
}): object {
  const certPemStripped = stripPemCertificate(publicCert);
  const [modulusB64, exponentB64] = extractPublicKeyInfo(certPemStripped);
  const saml2NameID = `CN=ihe."metriport.com",OU=CAREQUALITY,O=MetriportInc.,ST=California,C=US`;

  const securityHeader = {
    "wsse:Security": {
      "@_xmlns:wsse": namespaces.wsse,
      "@_xmlns:saml2": namespaces.saml2,
      "@_xmlns:ds": namespaces.ds,
      "@_xmlns:wsu": namespaces.wsu,
      "@_xmlns:xsi": namespaces.xsi,
      "@_xmlns:hl7": namespaces.hl7,
      "@_xmlns:xs": namespaces.xs,
      "saml2:Assertion": {
        "@_xsi:type": "saml2:AssertionType",
        "@_ID": securityHeaderEnvelopedId,
        "@_IssueInstant": createdTimestamp,
        "@_Version": "2.0",
        "saml2:Issuer": {
          "@_Format": "urn:oasis:names:tc:SAML:1.1:nameid-format:emailAddress",
          "#text": "support@metriport.com",
        },
        "saml2:Subject": {
          "saml2:NameID": {
            "@_Format": "urn:oasis:names:tc:SAML:1.1:nameid-format:X509SubjectName",
            "#text": saml2NameID,
          },
          "saml2:SubjectConfirmation": {
            "@_Method": "urn:oasis:names:tc:SAML:2.0:cm:holder-of-key",
            "saml2:SubjectConfirmationData": {
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
            },
          },
        },
        "saml2:Conditions": {
          "@_NotBefore": createdTimestamp,
          "@_NotOnOrAfter": expiresTimestamp,
          "saml2:AudienceRestriction": {
            "saml2:Audience": toUrl,
          },
        },
        "saml2:AuthnStatement": {
          "@_AuthnInstant": createdTimestamp,
          "saml2:SubjectLocality": {
            "@_Address": "127.0.0.1",
            "@_DNSName": "localhost",
          },
          "saml2:AuthnContext": {
            "saml2:AuthnContextClassRef": "urn:oasis:names:tc:SAML:2.0:ac:classes:X509",
          },
        },
        "saml2:AttributeStatement": {
          "saml2:Attribute": [
            {
              "@_Name": "urn:oasis:names:tc:xspa:1.0:subject:subject-id",
              "@_NameFormat": "urn:oasis:names:tc:SAML:2.0:attrname-format:uri",
              "saml2:AttributeValue": subjectRole,
            },
            {
              "@_Name": "urn:oasis:names:tc:xspa:1.0:subject:organization",
              "@_NameFormat": "urn:oasis:names:tc:SAML:2.0:attrname-format:uri",
              "saml2:AttributeValue": metriportOrganization,
            },
            {
              "@_Name": "urn:oasis:names:tc:xspa:1.0:subject:organization-id",
              "@_NameFormat": "urn:oasis:names:tc:SAML:2.0:attrname-format:uri",
              "saml2:AttributeValue": wrapIdInUrnOid(homeCommunityId),
            },
            {
              "@_Name": "urn:nhin:names:saml:homeCommunityId",
              "@_NameFormat": "urn:oasis:names:tc:SAML:2.0:attrname-format:uri",
              "saml2:AttributeValue": wrapIdInUrnOid(homeCommunityId),
            },
            {
              "@_Name": "urn:oasis:names:tc:xacml:2.0:subject:role",
              "@_NameFormat": "urn:oasis:names:tc:SAML:2.0:attrname-format:uri",
              "saml2:AttributeValue": {
                "@_xsi:type": namespaces.ce,
                "hl7:Role": {
                  "@_xsi:type": namespaces.ce,
                  "@_code": "106331006",
                  "@_codeSystem": SNOMED_CODE,
                  "@_codeSystemName": "SNOMED_CT",
                  "@_displayName": "Administrative AND/OR managerial worker",
                },
              },
            },
            {
              "@_Name": "urn:oasis:names:tc:xspa:1.0:subject:purposeofuse",
              "@_NameFormat": "urn:oasis:names:tc:SAML:2.0:attrname-format:uri",
              "saml2:AttributeValue": {
                "@_xmlns:xsi": namespaces.xsi,
                "@_xsi:type": namespaces.ce,
                "hl7:PurposeOfUse": {
                  "@_code": purposeOfUse,
                  "@_codeSystem": NHIN_PURPOSE_CODE_SYSTEM,
                  "@_codeSystemName": "nhin-purpose",
                  "@_displayName": "Treatment",
                },
              },
            },
          ],
        },
      },
      "wsu:Timestamp": {
        "@_wsu:Id": securityHeaderTimestampId,
        "wsu:Created": createdTimestamp,
        "wsu:Expires": expiresTimestamp,
      },
    },
  };
  return securityHeader;
}

export function extractPublicKeyInfo(certificatePem: string) {
  const derBuffer = Buffer.from(certificatePem, "base64");
  const asn1 = asn1js.fromBER(
    derBuffer.buffer.slice(derBuffer.byteOffset, derBuffer.byteOffset + derBuffer.byteLength)
  );
  if (asn1.offset === -1) {
    throw new Error("Error during ASN.1 parsing.");
  }

  const certificate = new pkijs.Certificate({ schema: asn1.result });
  const publicKey = certificate.subjectPublicKeyInfo;
  if (!publicKey.parsedKey) {
    throw new Error("Public key information is undefined.");
  }
  const rsaPublicKey = new pkijs.RSAPublicKey({ schema: publicKey.parsedKey.toSchema() });
  const modulus = toBase64(arrayBufferToString(rsaPublicKey.modulus.valueBlock.valueHex));
  const exponent = toBase64(arrayBufferToString(rsaPublicKey.publicExponent.valueBlock.valueHex));
  return [modulus, exponent];
}

export function stripPemCertificate(x509CertPem: string): string {
  let certPemStripped = x509CertPem
    .replace(BEGIN_CERTIFICATE_REGEX, "")
    .replace(END_CERTIFICATE_REGEX, "");
  certPemStripped = certPemStripped.replace(NEWLINE_REGEX, "");
  return certPemStripped;
}

import * as asn1js from "asn1js";
import * as pkijs from "pkijs";
import { arrayBufferToString, toBase64 } from "pvutils";
import { NHIN_PURPOSE_CODE_SYSTEM, SNOMED_CODE } from "../../../../../shareback/metadata/constants";
import { wrapIdInUrnOid } from "../../../../../util/urn";
import { namespaces } from "../../constants";

const BEGIN_CERTIFICATE_REGEX = /-----BEGIN CERTIFICATE-----\r?\n/;
const END_CERTIFICATE_REGEX = /-----END CERTIFICATE-----\r?\n?$/;
const NEWLINE_REGEX = /\r?\n/g;

export const securityHeaderTimestampId = "TS-7c229e85-d62b-471e-9112-a49d1c365004";
export const securityHeaderEnvelopedId = "TS_3e57269d-075d-4d3f-9f5d-c97ad6afc009";
export const basicRequiredOid = "1.3.6.1.4.1.41800.100";

/**
 * Creates the security header for the SOAP envelope.
 *
 * The QueryAuthGrantor attribute is only added if the queryGrantorOid is provided.
 * @see section 3.7.2 of this document: https://carequality.org/wp-content/uploads/2025/05/Carequality-Framework-Policies-Document-v3.0-FINAL-20250512.pdf
 */
export function createSecurityHeader({
  publicCert,
  createdTimestamp,
  expiresTimestamp,
  toUrl,
  subjectRole,
  metriportOrganization,
  homeCommunityId,
  purposeOfUse,
  gatewayOid,
  queryGrantorOid,
}: {
  publicCert: string;
  createdTimestamp: string;
  expiresTimestamp: string;
  toUrl: string;
  subjectRole: string;
  metriportOrganization: string;
  homeCommunityId: string;
  purposeOfUse: string;
  gatewayOid?: string;
  queryGrantorOid: string | undefined;
}): object {
  const certPemStripped = stripPemCertificate(publicCert);
  const [modulusB64, exponentB64] = extractPublicKeyInfo(certPemStripped);
  const saml2NameID = `CN=ihe.metriport.com,OU=CAREQUALITY,O=MetriportInc.,ST=California,C=US`;

  // MUTEX. One ehex endpoint will fail if the subjectIdNameFormat is not set to basic, while the other 2.16.840.1.113883.3.7732.100 will fail if it is not set to uri.
  const subjectIdNameFormat =
    gatewayOid && gatewayOid === basicRequiredOid
      ? "urn:oasis:names:tc:SAML:2.0:attrname-format:basic"
      : "urn:oasis:names:tc:SAML:2.0:attrname-format:uri";

  const securityHeader = {
    "wsse:Security": {
      "@_xmlns:wsse": namespaces.wsse,
      "@_xmlns:ds": namespaces.ds,
      "@_xmlns:wsu": namespaces.wsu,
      "wsu:Timestamp": {
        "@_wsu:Id": securityHeaderTimestampId,
        "wsu:Created": createdTimestamp,
        "wsu:Expires": expiresTimestamp,
      },
      "saml2:Assertion": {
        "@_xmlns:saml2": namespaces.saml2,
        "@_xmlns:xsd": namespaces.xsd,
        "@_xmlns:xsi": namespaces.xsi,
        "@_ID": securityHeaderEnvelopedId,
        "@_IssueInstant": createdTimestamp,
        "@_Version": "2.0",
        "@_xsi:type": "saml2:AssertionType",
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
              "@_NameFormat": subjectIdNameFormat,
              "saml2:AttributeValue": {
                "@_xsi:type": namespaces.xsiType,
                "#text": subjectRole,
              },
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
              "saml2:AttributeValue": {
                "hl7:Role": {
                  "@_xmlns:hl7": namespaces.hl7,
                  "@_code": "224608005",
                  "@_codeSystem": SNOMED_CODE,
                  "@_codeSystemName": "SNOMED_CT",
                  "@_displayName": "Administrative AND/OR managerial worker",
                },
              },
            },
            {
              "@_Name": "urn:oasis:names:tc:xspa:1.0:subject:purposeofuse",
              "saml2:AttributeValue": {
                "@_xmlns:xsi": namespaces.xsi,
                "hl7:PurposeOfUse": {
                  "@_xmlns:hl7": namespaces.hl7,
                  "@_xsi:type": namespaces.ce,
                  "@_code": purposeOfUse,
                  "@_codeSystem": NHIN_PURPOSE_CODE_SYSTEM,
                  "@_codeSystemName": "nhin-purpose",
                  "@_displayName": "Treatment",
                },
              },
            },
            ...(queryGrantorOid
              ? [
                  {
                    "@_Name": "QueryAuthGrantor",
                    "@_NameFormat": "urn:oasis:names:tc:SAML:2.0:attrname-format:uri",
                    "saml2:AttributeValue": `Organization/${queryGrantorOid}`,
                  },
                ]
              : []),
          ],
        },
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

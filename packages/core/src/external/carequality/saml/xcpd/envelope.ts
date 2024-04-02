import { XMLBuilder } from "fast-xml-parser";
import * as pkijs from "pkijs";
import * as asn1js from "asn1js";
import { arrayBufferToString, toBase64 } from "pvutils";

const action = "urn:hl7-org:v3:PRPA_IN201305UV02:CrossGatewayPatientDiscovery";
const metriport_organization = "Metriport";
const metriport_home_community_id = "2.16.840.1.113883.3.9621";
const reply_to = "http://www.w3.org/2005/08/addressing/anonymous";
const saml2_NameID = "CN=ihe.metriport.com,OU=CAREQUALITY,O=MetriportInc.,ST=California,C=US";

const security_header_timestamp_id = "TS-7c229e85-d62b-471e-9112-a49d1c365004";
const security_header_enveloped_id = "_3e57269d-075d-4d3f-9f5d-c97ad6afc009";

export const namespaces = {
  soap: "http://www.w3.org/2003/05/soap-envelope",
  wsa: "http://www.w3.org/2005/08/addressing",
  urn: "urn:hl7-org:v3",
};

interface XCPDBodyData {
  id: string;
  gateway: {
    oid: string;
    url: string;
  };
  principalCareProviderIds: string[];
  samlAttributes: {
    subjectRole: {
      display: string;
    };
    organization: string;
    organizationId: string;
    homeCommunityId: string;
    purposeOfUse: string;
  };
  patientResource: {
    gender: string;
    birthDate: string;
    name: Array<{
      family: string;
      given: string[];
    }>;
    address: Array<{
      street: string[];
      city: string;
      state: string;
      postalCode: string;
      country: string;
    }>;
    telecom?: Array<{
      value: string;
    }>;
  };
}

export function createSoapEnvelope(bodyData: XCPDBodyData, x509CertPem: string): string {
  const message_id = `urn:uuid:${bodyData.id}`;
  const receiver_device_id = bodyData.gateway.oid;
  const to_url = bodyData.gateway.url;
  const provider_id = bodyData.principalCareProviderIds[0];

  const subject_role = bodyData.samlAttributes.subjectRole.display;
  // const organization = bodyData.samlAttributes.organization;
  // const organization_id = bodyData.samlAttributes.organizationId;
  const home_community_id = bodyData.samlAttributes.homeCommunityId;
  const purpose_of_use = bodyData.samlAttributes.purposeOfUse;

  const patient_gender = bodyData.patientResource.gender === "female" ? "F" : "M";
  const patient_birthtime = bodyData.patientResource.birthDate.replace(/-/g, "");
  const patient_family_name = bodyData.patientResource.name?.[0]?.family;
  const patient_given_name = bodyData.patientResource.name?.[0]?.given?.[0];
  const patient_address = bodyData.patientResource.address?.[0];
  const patient_telecom = bodyData.patientResource.telecom?.[0]?.value ?? null;

  const created_timestamp = new Date().toISOString();
  const expires_timestamp = new Date(
    new Date(created_timestamp).getTime() + 60 * 60 * 1000
  ).toISOString();
  const cert_pem_stripped = stripPemCertificate(x509CertPem);
  const [modulus_b64, exponent_b64] = extractPublicKeyInfo(cert_pem_stripped);

  const soapEnvelope = {
    "soap:Envelope": {
      "@_xmlns:soap": "http://schemas.xmlsoap.org/soap/envelope/",
      "@_xmlns:wsa": "http://www.w3.org/2005/08/addressing",
      "soap:Header": {
        "wsa:To": {
          "#text": to_url,
          "@_mustUnderstand": "1",
        },
        "wsa:Action": {
          "#text": action,
          "@_mustUnderstand": "1",
        },
        "wsa:MessageID": message_id,
        "wsa:ReplyTo": {
          "wsa:Address": reply_to,
        },
        "wsse:Security": {
          "@_xmlns:wsse":
            "http://docs.oasis-open.org/wss/2004/01/oasis-200401-wss-wssecurity-secext-1.0.xsd",
          "@_xmlns:saml2": "urn:oasis:names:tc:SAML:2.0:assertion",
          "@_xmlns:ds": "http://www.w3.org/2000/09/xmldsig#",
          "@_xmlns:wsu":
            "http://docs.oasis-open.org/wss/2004/01/oasis-200401-wss-wssecurity-utility-1.0.xsd",
          "@_xmlns:xsi": "http://www.w3.org/2001/XMLSchema-instance",
          "@_xmlns:hl7": "urn:hl7-org:v3",
          "@_xmlns:xs": "http://www.w3.org/2001/XMLSchema",
          "saml2:Assertion": {
            "@_Id": security_header_enveloped_id,
            "@_IssueInstant": created_timestamp,
            "@_Version": "2.0",
            "saml2:Issuer": {
              "@_Format": "urn:oasis:names:tc:SAML:1.1:nameid-format:emailAddress",
              "#text": "support@metriport.com",
            },
            "saml2:Subject": {
              "saml2:NameID": {
                "@_Format": "urn:oasis:names:tc:SAML:1.1:nameid-format:X509SubjectName",
                "#text": saml2_NameID,
              },
              "saml2:SubjectConfirmation": {
                "@_Method": "urn:oasis:names:tc:SAML:2.0:cm:holder-of-key",
                "saml2:SubjectConfirmationData": {
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
                },
              },
            },
            "saml2:Conditions": {
              "@_NotBefore": created_timestamp,
              "@_NotOnOrAfter": expires_timestamp,
              "saml2:AudienceRestriction": {
                "saml2:Audience": to_url,
              },
            },
            "saml2:AuthnStatement": {
              "@_AuthnInstant": created_timestamp,
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
                  "saml2:AttributeValue": subject_role,
                },
                {
                  "@_Name": "urn:oasis:names:tc:xspa:1.0:subject:organization",
                  "@_NameFormat": "urn:oasis:names:tc:SAML:2.0:attrname-format:uri",
                  "saml2:AttributeValue": metriport_organization,
                },
                {
                  "@_Name": "urn:oasis:names:tc:xspa:1.0:subject:organization-id",
                  "@_NameFormat": "urn:oasis:names:tc:SAML:2.0:attrname-format:uri",
                  "saml2:AttributeValue": home_community_id,
                },
                {
                  "@_Name": "urn:nhin:names:saml:homeCommunityId",
                  "@_NameFormat": "urn:oasis:names:tc:SAML:2.0:attrname-format:uri",
                  "saml2:AttributeValue": home_community_id,
                },
                {
                  "@_Name": "urn:oasis:names:tc:xacml:2.0:subject:role",
                  "@_NameFormat": "urn:oasis:names:tc:SAML:2.0:attrname-format:uri",
                  "saml2:AttributeValue": {
                    "@_xmlns:xsi": "http://www.w3.org/2001/XMLSchema-instance",
                    "@_xsi:type": "hl7:CE",
                    "hl7:Role": {
                      "@_code": "106331006",
                      "@_codeSystem": "2.16.840.1.113883.6.96",
                      "@_codeSystemName": "SNOMED_CT",
                      "@_displayName": "Administrative AND/OR managerial worker",
                    },
                  },
                },
                {
                  "@_Name": "urn:oasis:names:tc:xspa:1.0:subject:purposeofuse",
                  "@_NameFormat": "urn:oasis:names:tc:SAML:2.0:attrname-format:uri",
                  "saml2:AttributeValue": {
                    "@_xmlns:xsi": "http://www.w3.org/2001/XMLSchema-instance",
                    "@_xsi:type": "hl7:CE",
                    "hl7:PurposeOfUse": {
                      "@_code": purpose_of_use,
                      "@_codeSystem": "2.16.840.1.113883.3.18.7.1",
                      "@_codeSystemName": "nhin-purpose",
                      "@_displayName": "Treatment",
                    },
                  },
                },
              ],
            },
          },
          "wsu:Timestamp": {
            "@_Id": security_header_timestamp_id,
            "wsu:Created": created_timestamp,
            "wsu:Expires": expires_timestamp,
          },
        },
        "soap:Body": {
          "@_xmlns:urn": "urn:hl7-org:v3",
          "urn:PRPA_IN201305UV02": {
            "@_ITSVersion": "XML_1.0",
            "urn:id": {
              "@_extension": message_id,
              "@_root": home_community_id,
            },
            "urn:created_timestamp": {
              "#text": created_timestamp,
            },
            "urn:interactionId": {
              "@_extension": "PRPA_IN201305UV02",
              "@_root": "2.16.840.1.113883.1.6",
            },
            "urn:processingCode": {
              "@_code": "T",
            },
            "urn:processingModeCode": {
              "@_code": "T",
            },
            "urn:acceptAckCode": {
              "@_code": "AL",
            },
            "urn:receiver": {
              "@_typeCode": "RCV",
              "urn:device": {
                "@_classCode": "DEV",
                "@_determinerCode": "INSTANCE",
                "urn:id": {
                  "@_root": receiver_device_id,
                },
                "urn:telecom": {
                  "@_value": to_url,
                },
                "urn:asAgent": {
                  "@_classCode": "AGNT",
                  "urn:representedOrganization": {
                    "@_classCode": "ORG",
                    "@_determinerCode": "INSTANCE",
                    "urn:id": {
                      "@_root": receiver_device_id,
                    },
                  },
                },
              },
            },
            "urn:sender": {
              "@_typeCode": "SND",
              "urn:device": {
                "@_classCode": "DEV",
                "@_determinerCode": "INSTANCE",
                "urn:id": {
                  "@_root": metriport_home_community_id,
                },
                "urn:asAgent": {
                  "@_classCode": "AGNT",
                  "urn:representedOrganization": {
                    "@_classCode": "ORG",
                    "@_determinerCode": "INSTANCE",
                    "urn:id": {
                      "@_root": metriport_home_community_id,
                    },
                    "urn:name": metriport_organization,
                  },
                },
              },
            },
            "urn:controlActProcess": {
              "@_classCode": "CACT",
              "@_moodCode": "EVN",
              "urn:code": {
                "@_code": "PRPA_TE201305UV02",
                "@_codeSystem": "2.16.840.1.113883.1.6",
              },
              "urn:queryByParameter": {
                "urn:queryId": {
                  "@_extension": message_id,
                  "@_root": home_community_id,
                },
                "urn:statusCode": {
                  "@_code": "new",
                },
                "urn:responseModalityCode": {
                  "@_code": "R",
                },
                "urn:responsePriorityCode": {
                  "@_code": "I",
                },
                "urn:parameterList": {
                  "urn:livingSubjectAdministrativeGender": {
                    "urn:value": {
                      "@_code": patient_gender,
                      "@_codeSystem": "2.16.840.1.113883.5.1",
                    },
                    "urn:semanticsText": "LivingSubject.administrativeGender",
                  },
                  "urn:livingSubjectBirthTime": {
                    "urn:value": {
                      "@_value": patient_birthtime,
                    },
                    "urn:semanticsText": "LivingSubject.birthTime",
                  },
                  "urn:livingSubjectName": {
                    "urn:value": {
                      "urn:family": patient_family_name,
                      "urn:given": patient_given_name,
                    },
                    "urn:semanticsText": "LivingSubject.name",
                  },
                  "urn:patientAddress": patient_address
                    ? {
                        "urn:value": {
                          "urn:streetAddressLine": patient_address.street,
                          "urn:city": patient_address.city,
                          "urn:state": patient_address.state,
                          "urn:postalCode": patient_address.postalCode,
                          "urn:country": patient_address.country,
                        },
                        "urn:semanticsText": "Patient.addr",
                      }
                    : {},
                  "urn:patientTelecom": patient_telecom
                    ? {
                        "urn:value": {
                          "@_value": patient_telecom,
                        },
                        "urn:semanticsText": "Patient.telecom",
                      }
                    : {},
                  "urn:principalCareProviderId": {
                    "urn:value": {
                      "@_extension": provider_id,
                      "@_root": "2.16.840.1.113883.4.6",
                    },
                  },
                },
              },
            },
          },
        },
      },
    },
  };

  const options = {
    format: false,
    ignoreAttributes: false,
  };

  const builder = new XMLBuilder(options);
  const xmlContent = builder.build(soapEnvelope);

  return xmlContent;
}

function extractPublicKeyInfo(certificatePem: string) {
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

function stripPemCertificate(x509CertPem: string): string {
  let certPemStripped = x509CertPem
    .replace(/-----BEGIN CERTIFICATE-----\r?\n/, "")
    .replace(/-----END CERTIFICATE-----\r?\n?$/, "");
  certPemStripped = certPemStripped.replace(/\r?\n/g, "");
  return certPemStripped;
}

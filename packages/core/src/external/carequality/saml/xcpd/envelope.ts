import { XMLBuilder } from "fast-xml-parser";
import { createSecurityHeader } from "../security/security-header";

const action = "urn:hl7-org:v3:PRPA_IN201305UV02:CrossGatewayPatientDiscovery";
const metriport_organization = "Metriport";
const metriport_home_community_id = "2.16.840.1.113883.3.9621";
const reply_to = "http://www.w3.org/2005/08/addressing/anonymous";

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
      line: string[];
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
  // const patient_telecom = bodyData.patientResource.telecom?.[0]?.value ?? undefined;

  const created_timestamp = new Date().toISOString();
  const expires_timestamp = new Date(
    new Date(created_timestamp).getTime() + 60 * 60 * 1000
  ).toISOString();

  const securityHeader = createSecurityHeader(
    x509CertPem,
    created_timestamp,
    expires_timestamp,
    to_url,
    subject_role,
    metriport_organization,
    home_community_id,
    purpose_of_use
  );

  const soapBody = {
    "soap:Body": {
      "@_xmlns:urn": "urn:hl7-org:v3",
      "urn:PRPA_IN201305UV02": {
        "@_ITSVersion": "XML_1.0",
        "urn:id": {
          "@_extension": message_id,
          "@_root": home_community_id,
        },
        "urn:creationTime": {
          "@_value": created_timestamp,
        },
        "urn:interactionId": {
          "@_extension": "PRPA_IN201305UV02",
          "@_root": "2.16.840.1.113883.1.6",
        },
        "urn:processingCode": {
          "@_code": "P",
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
                      "urn:streetAddressLine": patient_address.line.join(", "),
                      "urn:city": patient_address.city,
                      "urn:state": patient_address.state,
                      "urn:postalCode": patient_address.postalCode,
                      "urn:country": patient_address.country,
                    },
                    "urn:semanticsText": "Patient.addr",
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
  };

  const soapEnvelope = {
    "soap:Envelope": {
      "@_xmlns:soap": "http://schemas.xmlsoap.org/soap/envelope/",
      "soap:Header": {
        "@_xmlns:wsa": "http://www.w3.org/2005/08/addressing",
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
        ...securityHeader,
      },
      ...soapBody,
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

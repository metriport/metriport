import { XMLBuilder } from "fast-xml-parser";
import dayjs from "dayjs";
import { createSecurityHeader } from "../security/security-header";
import { signFullSaml } from "../security/sign";
import { namespaces } from "../namespaces";
import {
  ORGANIZATION_NAME_DEFAULT as metriport_organization,
  METRIPORT_HOME_COMMUNITY_ID_NO_PREFIX,
  reply_to,
} from "../../carequality/shared";

const DATE_DASHES_REGEX = /-/g;

const action = "urn:hl7-org:v3:PRPA_IN201305UV02:CrossGatewayPatientDiscovery";

type XCPDBodyData = {
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
};

function createSoapBody({
  bodyData,
  created_timestamp,
}: {
  bodyData: XCPDBodyData;
  created_timestamp: string;
}): object {
  const message_id = `urn:uuid:${bodyData.id}`;
  const receiver_device_id = bodyData.gateway.oid;
  const to_url = bodyData.gateway.url;
  const provider_id = bodyData.principalCareProviderIds[0];
  const home_community_id = bodyData.samlAttributes.homeCommunityId;
  const patient_gender = bodyData.patientResource.gender === "female" ? "F" : "M";
  const patient_birthtime = bodyData.patientResource.birthDate.replace(DATE_DASHES_REGEX, "");
  const patient_family_name = bodyData.patientResource.name?.[0]?.family;
  const patient_given_name = bodyData.patientResource.name?.[0]?.given?.[0];
  const patient_address = bodyData.patientResource.address?.[0];
  const patient_telecom = bodyData.patientResource.telecom?.[0]?.value ?? undefined;

  const soapBody = {
    "soap:Body": {
      "@_xmlns:urn": namespaces.urn,
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
              "@_root": METRIPORT_HOME_COMMUNITY_ID_NO_PREFIX,
            },
            "urn:asAgent": {
              "@_classCode": "AGNT",
              "urn:representedOrganization": {
                "@_classCode": "ORG",
                "@_determinerCode": "INSTANCE",
                "urn:id": {
                  "@_root": METRIPORT_HOME_COMMUNITY_ID_NO_PREFIX,
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
              "urn:patientTelecom": patient_telecom
                ? {
                    "urn:value": patient_telecom,
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
  };
  return soapBody;
}

export function createSoapEnvelope({
  bodyData,
  publicCert,
}: {
  bodyData: XCPDBodyData;
  publicCert: string;
}): string {
  const message_id = `urn:uuid:${bodyData.id}`;
  const to_url = bodyData.gateway.url;
  const subject_role = bodyData.samlAttributes.subjectRole.display;
  const home_community_id = bodyData.samlAttributes.homeCommunityId;
  const purpose_of_use = bodyData.samlAttributes.purposeOfUse;

  const created_timestamp = dayjs().toISOString();
  const expires_timestamp = dayjs(created_timestamp).add(1, "hour").toISOString();

  const securityHeader = createSecurityHeader({
    publicCert,
    created_timestamp,
    expires_timestamp,
    to_url,
    subject_role,
    metriport_organization,
    home_community_id,
    purpose_of_use,
  });

  const soapBody = createSoapBody({ bodyData, created_timestamp });

  const soapEnvelope = {
    "soap:Envelope": {
      "@_xmlns:soap": namespaces.soap,
      "soap:Header": {
        "@_xmlns:wsa": namespaces.wsa,
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

export function createAndSignXCPDRequest(
  bodyData: XCPDBodyData,
  publicCert: string,
  privateKey: string
): string {
  const xmlString = createSoapEnvelope({ bodyData, publicCert });
  const fullySignedSaml = signFullSaml({ xmlString, publicCert, privateKey });
  return fullySignedSaml;
}

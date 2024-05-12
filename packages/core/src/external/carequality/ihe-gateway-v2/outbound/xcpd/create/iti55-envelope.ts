import { XMLBuilder } from "fast-xml-parser";
import dayjs from "dayjs";
import { createSecurityHeader } from "../../../saml/security/security-header";
import { signFullSaml } from "../../../saml/security/sign";
import { SamlCertsAndKeys } from "../../../saml/security/types";
import { namespaces, expiresIn } from "../../../constants";
import {
  ORGANIZATION_NAME_DEFAULT as metriportOrganization,
  METRIPORT_HOME_COMMUNITY_ID_NO_PREFIX,
  replyTo,
} from "../../../../shared";
import { OutboundPatientDiscoveryReq, XCPDGateway } from "@metriport/ihe-gateway-sdk";
import { timestampToSoapBody } from "../../../utils";
import { wrapIdInUrnUuid } from "../../../../../../util/urn";

const DATE_DASHES_REGEX = /-/g;
const action = "urn:hl7-org:v3:PRPA_IN201305UV02:CrossGatewayPatientDiscovery";
const specialNamespaceRequiredUrl =
  "https://www.medentcq.com:14430/MedentRespondingGateway-1.0-SNAPSHOT/RespondingGateway/xcpd-iti55";

export type BulkSignedXCPD = {
  gateway: XCPDGateway;
  signedRequest: string;
  outboundRequest: OutboundPatientDiscoveryReq;
};

function createSoapBody({
  bodyData,
  createdTimestamp,
}: {
  bodyData: OutboundPatientDiscoveryReq;
  createdTimestamp: string;
}): object {
  const gateway = bodyData.gateways?.[0];
  if (!gateway) {
    throw new Error("Gateway is required to build ITI-55 Request body");
  }
  const messageId = `urn:uuid:${bodyData.id}`;
  const receiverDeviceId = gateway.oid;
  const toUrl = gateway.url;
  const providerId = bodyData.principalCareProviderIds[0];
  const homeCommunityId = bodyData.samlAttributes.homeCommunityId;
  const patientGender = bodyData.patientResource.gender === "female" ? "F" : "M";
  const patientBirthtime = bodyData.patientResource.birthDate.replace(DATE_DASHES_REGEX, "");
  const patientFamilyName = bodyData.patientResource.name?.[0]?.family;
  const patientGivenName = bodyData.patientResource.name?.[0]?.given?.[0];
  const patientAddress = bodyData.patientResource.address?.[0];
  const patientTelecom = bodyData.patientResource.telecom?.[0]?.value ?? undefined;

  if (gateway.url !== specialNamespaceRequiredUrl) {
    const soapBody = {
      "soap:Body": {
        "@_xmlns:urn": namespaces.hl7,
        "urn:PRPA_IN201305UV02": {
          "@_ITSVersion": "XML_1.0",
          "urn:id": {
            "@_extension": messageId,
            "@_root": homeCommunityId,
          },
          "urn:creationTime": {
            "@_value": timestampToSoapBody(createdTimestamp),
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
                "@_root": receiverDeviceId,
              },
              "urn:telecom": {
                "@_value": toUrl,
              },
              "urn:asAgent": {
                "@_classCode": "AGNT",
                "urn:representedOrganization": {
                  "@_classCode": "ORG",
                  "@_determinerCode": "INSTANCE",
                  "urn:id": {
                    "@_root": receiverDeviceId,
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
                  "urn:name": metriportOrganization,
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
                "@_extension": messageId,
                "@_root": homeCommunityId,
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
                    "@_code": patientGender,
                    "@_codeSystem": "2.16.840.1.113883.5.1",
                  },
                  "urn:semanticsText": "LivingSubject.administrativeGender",
                },
                "urn:livingSubjectBirthTime": {
                  "urn:value": {
                    "@_value": patientBirthtime,
                  },
                  "urn:semanticsText": "LivingSubject.birthTime",
                },
                "urn:livingSubjectName": {
                  "urn:value": {
                    "urn:family": patientFamilyName,
                    "urn:given": patientGivenName,
                  },
                  "urn:semanticsText": "LivingSubject.name",
                },
                "urn:patientAddress": patientAddress
                  ? {
                      "urn:value": {
                        "urn:streetAddressLine": patientAddress.line.join(", "),
                        "urn:city": patientAddress?.city,
                        "urn:state": patientAddress?.state,
                        "urn:postalCode": patientAddress?.postalCode,
                        "urn:country": patientAddress?.country,
                      },
                      "urn:semanticsText": "Patient.addr",
                    }
                  : {},
                "urn:patientTelecom": patientTelecom
                  ? {
                      "urn:value": {
                        "@_use": "HP",
                        "@_value": patientTelecom,
                      },
                      "urn:semanticsText": "Patient.telecom",
                    }
                  : {},
                "urn:principalCareProviderId": {
                  "urn:value": {
                    "@_extension": providerId,
                    "@_root": "2.16.840.1.113883.4.6",
                  },
                  "urn:semanticsText": "AssignedProvider.id",
                },
              },
            },
          },
        },
      },
    };
    return soapBody;
  } else {
    const soapBody = {
      "soap:Body": {
        "@_xmlns:urn": namespaces.hl7,
        "urn:PRPA_IN201305UV02": {
          "@_ITSVersion": "XML_1.0",
          id: {
            "@_extension": messageId,
            "@_root": homeCommunityId,
          },
          creationTime: {
            "@_value": timestampToSoapBody(createdTimestamp),
          },
          interactionId: {
            "@_extension": "PRPA_IN201305UV02",
            "@_root": "2.16.840.1.113883.1.6",
          },
          processingCode: {
            "@_code": "P",
          },
          processingModeCode: {
            "@_code": "T",
          },
          acceptAckCode: {
            "@_code": "AL",
          },
          receiver: {
            "@_typeCode": "RCV",
            device: {
              "@_classCode": "DEV",
              "@_determinerCode": "INSTANCE",
              id: {
                "@_root": receiverDeviceId,
              },
              telecom: {
                "@_value": toUrl,
              },
              asAgent: {
                "@_classCode": "AGNT",
                representedOrganization: {
                  "@_classCode": "ORG",
                  "@_determinerCode": "INSTANCE",
                  id: {
                    "@_root": receiverDeviceId,
                  },
                },
              },
            },
          },
          sender: {
            "@_typeCode": "SND",
            device: {
              "@_classCode": "DEV",
              "@_determinerCode": "INSTANCE",
              id: {
                "@_root": METRIPORT_HOME_COMMUNITY_ID_NO_PREFIX,
              },
              asAgent: {
                "@_classCode": "AGNT",
                representedOrganization: {
                  "@_classCode": "ORG",
                  "@_determinerCode": "INSTANCE",
                  id: {
                    "@_root": METRIPORT_HOME_COMMUNITY_ID_NO_PREFIX,
                  },
                  name: metriportOrganization,
                },
              },
            },
          },
          controlActProcess: {
            "@_classCode": "CACT",
            "@_moodCode": "EVN",
            code: {
              "@_code": "PRPA_TE201305UV02",
              "@_codeSystem": "2.16.840.1.113883.1.6",
            },
            queryByParameter: {
              queryId: {
                "@_extension": messageId,
                "@_root": homeCommunityId,
              },
              statusCode: {
                "@_code": "new",
              },
              responseModalityCode: {
                "@_code": "R",
              },
              responsePriorityCode: {
                "@_code": "I",
              },
              parameterList: {
                livingSubjectAdministrativeGender: {
                  value: {
                    "@_code": patientGender,
                    "@_codeSystem": "2.16.840.1.113883.5.1",
                  },
                  semanticsText: "LivingSubject.administrativeGender",
                },
                livingSubjectBirthTime: {
                  value: {
                    "@_value": patientBirthtime,
                  },
                  semanticsText: "LivingSubject.birthTime",
                },
                livingSubjectName: {
                  value: {
                    family: patientFamilyName,
                    given: patientGivenName,
                  },
                  semanticsText: "LivingSubject.name",
                },
                patientAddress: patientAddress
                  ? {
                      value: {
                        streetAddressLine: patientAddress.line.join(", "),
                        city: patientAddress?.city,
                        state: patientAddress?.state,
                        postalCode: patientAddress?.postalCode,
                        country: patientAddress?.country,
                      },
                      semanticsText: "Patient.addr",
                    }
                  : {},
                patientTelecom: patientTelecom
                  ? {
                      value: {
                        "@_use": "HP",
                        "@_value": patientTelecom,
                      },
                      semanticsText: "Patient.telecom",
                    }
                  : {},
                principalCareProviderId: {
                  value: {
                    "@_extension": providerId,
                    "@_root": "2.16.840.1.113883.4.6",
                  },
                  semanticsText: "AssignedProvider.id",
                },
              },
            },
          },
        },
      },
    };
    return soapBody;
  }
}

export function createITI5SoapEnvelope({
  bodyData,
  publicCert,
}: {
  bodyData: OutboundPatientDiscoveryReq;
  publicCert: string;
}): string {
  const gateway = bodyData.gateways?.[0];
  if (!gateway) {
    throw new Error("Gateway is required to build ITI-55 Request body");
  }
  const messageId = wrapIdInUrnUuid(bodyData.id);
  const toUrl = gateway.url;
  const gatewayOid = gateway.oid;
  const subjectRole = bodyData.samlAttributes.subjectRole.display;
  const homeCommunityId = bodyData.samlAttributes.homeCommunityId;
  const purposeOfUse = bodyData.samlAttributes.purposeOfUse;

  const createdTimestamp = dayjs().toISOString();
  const expiresTimestamp = dayjs(createdTimestamp).add(expiresIn, "minute").toISOString();
  const securityHeader = createSecurityHeader({
    publicCert,
    createdTimestamp,
    expiresTimestamp,
    toUrl,
    subjectRole,
    metriportOrganization,
    homeCommunityId,
    purposeOfUse,
    gatewayOid,
  });

  const soapBody = createSoapBody({ bodyData, createdTimestamp });

  const soapEnvelope = {
    "soap:Envelope": {
      "@_xmlns:soap": namespaces.soap,
      "soap:Header": {
        ...securityHeader,
        "@_xmlns:wsa": namespaces.wsa,
        "wsa:To": {
          "#text": toUrl,
          "@_mustUnderstand": "1",
        },
        "wsa:Action": {
          "#text": action,
          "@_mustUnderstand": "1",
        },
        "wsa:MessageID": messageId,
        "wsa:ReplyTo": {
          "wsa:Address": replyTo,
        },
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

export function createAndSignBulkXCPDRequests(
  bulkBodyData: OutboundPatientDiscoveryReq,
  samlCertsAndKeys: SamlCertsAndKeys
): BulkSignedXCPD[] {
  const signedRequests: BulkSignedXCPD[] = [];

  for (const gateway of bulkBodyData.gateways) {
    const bodyData: OutboundPatientDiscoveryReq = {
      ...bulkBodyData,
      gateways: [gateway],
    };

    const xmlString = createITI5SoapEnvelope({ bodyData, publicCert: samlCertsAndKeys.publicCert });
    const signedRequest = signFullSaml({ xmlString, samlCertsAndKeys });
    signedRequests.push({ gateway, signedRequest, outboundRequest: bodyData });
  }

  return signedRequests;
}

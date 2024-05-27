import { XMLBuilder } from "fast-xml-parser";
import dayjs from "dayjs";
import { Address, Telecom, Name, PersonalIdentifier } from "@metriport/ihe-gateway-sdk";
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
import { requiresUrnInSoapBody, getHomeCommunityId } from "../../../gateways";

const DATE_DASHES_REGEX = /-/g;
const action = "urn:hl7-org:v3:PRPA_IN201305UV02:CrossGatewayPatientDiscovery";
export type BulkSignedXCPD = {
  gateway: XCPDGateway;
  signedRequest: string;
  outboundRequest: OutboundPatientDiscoveryReq;
};

function createSoapBodyContent({
  messageId,
  homeCommunityId,
  createdTimestamp,
  receiverDeviceId,
  toUrl,
  patientGender,
  patientBirthtime,
  patientNames,
  patientAddresses,
  patientTelecoms,
  identifiers,
  providerId,
  useUrn = true,
}: {
  messageId: string;
  homeCommunityId: string;
  createdTimestamp: string;
  receiverDeviceId: string;
  toUrl: string;
  patientGender: string;
  patientBirthtime: string | undefined;
  patientNames: Name[] | undefined;
  patientAddresses: Address[] | undefined;
  patientTelecoms: Telecom[] | undefined;
  identifiers: PersonalIdentifier[] | undefined;
  providerId: string | undefined;
  useUrn?: boolean;
}): object {
  const prefix = useUrn ? "urn:" : "";
  const soapBody = {
    "@_xmlns:urn": namespaces.hl7,
    [`urn:PRPA_IN201305UV02`]: {
      "@_ITSVersion": "XML_1.0",
      [`${prefix}id`]: {
        "@_extension": messageId,
        "@_root": homeCommunityId,
      },
      [`${prefix}creationTime`]: {
        "@_value": timestampToSoapBody(createdTimestamp),
      },
      [`${prefix}interactionId`]: {
        "@_extension": "PRPA_IN201305UV02",
        "@_root": "2.16.840.1.113883.1.6",
      },
      [`${prefix}processingCode`]: {
        "@_code": "P",
      },
      [`${prefix}processingModeCode`]: {
        "@_code": "T",
      },
      [`${prefix}acceptAckCode`]: {
        "@_code": "AL",
      },
      [`${prefix}receiver`]: {
        "@_typeCode": "RCV",
        [`${prefix}device`]: {
          "@_classCode": "DEV",
          "@_determinerCode": "INSTANCE",
          [`${prefix}id`]: {
            "@_root": receiverDeviceId,
          },
          [`${prefix}telecom`]: {
            "@_value": toUrl,
          },
          [`${prefix}asAgent`]: {
            "@_classCode": "AGNT",
            [`${prefix}representedOrganization`]: {
              "@_classCode": "ORG",
              "@_determinerCode": "INSTANCE",
              [`${prefix}id`]: {
                "@_root": receiverDeviceId,
              },
            },
          },
        },
      },
      [`${prefix}sender`]: {
        "@_typeCode": "SND",
        [`${prefix}device`]: {
          "@_classCode": "DEV",
          "@_determinerCode": "INSTANCE",
          [`${prefix}id`]: {
            "@_root": METRIPORT_HOME_COMMUNITY_ID_NO_PREFIX,
          },
          [`${prefix}asAgent`]: {
            "@_classCode": "AGNT",
            [`${prefix}representedOrganization`]: {
              "@_classCode": "ORG",
              "@_determinerCode": "INSTANCE",
              [`${prefix}id`]: {
                "@_root": METRIPORT_HOME_COMMUNITY_ID_NO_PREFIX,
              },
              [`${prefix}name`]: metriportOrganization,
            },
          },
        },
      },
      [`${prefix}controlActProcess`]: {
        "@_classCode": "CACT",
        "@_moodCode": "EVN",
        [`${prefix}code`]: {
          "@_code": "PRPA_TE201305UV02",
          "@_codeSystem": "2.16.840.1.113883.1.6",
        },
        [`${prefix}queryByParameter`]: {
          [`${prefix}queryId`]: {
            "@_extension": messageId,
            "@_root": homeCommunityId,
          },
          [`${prefix}statusCode`]: {
            "@_code": "new",
          },
          [`${prefix}responseModalityCode`]: {
            "@_code": "R",
          },
          [`${prefix}responsePriorityCode`]: {
            "@_code": "I",
          },
          [`${prefix}parameterList`]: {
            [`${prefix}livingSubjectAdministrativeGender`]: {
              [`${prefix}value`]: {
                "@_code": patientGender,
                "@_codeSystem": "2.16.840.1.113883.5.1",
              },
              [`${prefix}semanticsText`]: "LivingSubject.administrativeGender",
            },
            [`${prefix}livingSubjectBirthTime`]: patientBirthtime
              ? {
                  [`${prefix}value`]: {
                    "@_value": patientBirthtime,
                  },
                  [`${prefix}semanticsText`]: "LivingSubject.birthTime",
                }
              : {},
            [`${prefix}livingSubjectId`]: identifiers
              ? {
                  [`${prefix}value`]: identifiers.map(identifier => ({
                    "@_extension": identifier.value,
                    "@_root": identifier.system,
                  })),
                  [`${prefix}semanticsText`]: "LivingSubject.id",
                }
              : {},
            [`${prefix}livingSubjectName`]: patientNames
              ? {
                  [`${prefix}value`]: patientNames.map(name => ({
                    [`${prefix}family`]: name.family,
                    ...name.given?.reduce((acc: { [key: string]: string }, givenName) => {
                      acc[`${prefix}given`] = givenName;
                      return acc;
                    }, {}),
                  })),
                  [`${prefix}semanticsText`]: "LivingSubject.name",
                }
              : {},
            [`${prefix}patientAddress`]: patientAddresses
              ? {
                  [`${prefix}value`]: patientAddresses.map(address => ({
                    [`${prefix}streetAddressLine`]: address.line?.join(", "),
                    [`${prefix}city`]: address.city,
                    [`${prefix}state`]: address.state,
                    [`${prefix}postalCode`]: address.postalCode,
                    [`${prefix}country`]: address.country,
                  })),
                  [`${prefix}semanticsText`]: "Patient.addr",
                }
              : {},
            [`${prefix}patientTelecom`]: patientTelecoms
              ? {
                  [`${prefix}value`]: patientTelecoms.map(telecom => ({
                    "@_use": telecom.system,
                    "@_value": telecom.value,
                  })),
                  [`${prefix}semanticsText`]: "Patient.telecom",
                }
              : {},
            ...(providerId
              ? {
                  [`${prefix}principalCareProviderId`]: {
                    [`${prefix}value`]: {
                      "@_extension": providerId,
                      "@_root": "2.16.840.1.113883.4.6",
                    },
                    [`${prefix}semanticsText`]: "AssignedProvider.id",
                  },
                }
              : {}),
          },
        },
      },
    },
  };

  return soapBody;
}

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
  const homeCommunityId = getHomeCommunityId(gateway, bodyData.samlAttributes);
  const patientGender = bodyData.patientResource.gender === "female" ? "F" : "M";
  const patientBirthtime = bodyData.patientResource.birthDate?.replace(DATE_DASHES_REGEX, "");
  const patientNames = bodyData.patientResource.name;
  const patientAddresses = bodyData.patientResource.address;
  const patientTelecoms = bodyData.patientResource.telecom;
  const identifiers = bodyData.patientResource.identifier;

  const useUrn = requiresUrnInSoapBody(gateway);
  const soapBody = {
    "soap:Body": createSoapBodyContent({
      messageId,
      homeCommunityId,
      createdTimestamp,
      receiverDeviceId,
      toUrl,
      patientGender,
      patientBirthtime,
      patientNames,
      patientAddresses,
      patientTelecoms,
      identifiers,
      providerId,
      useUrn,
    }),
  };
  return soapBody;
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
  const homeCommunityId = getHomeCommunityId(gateway, bodyData.samlAttributes);
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

import {
  Address,
  Name,
  OutboundPatientDiscoveryReq,
  PersonalIdentifier,
  Telecom,
  XCPDGateway,
} from "@metriport/ihe-gateway-sdk";
import {
  errorToString,
  METRIPORT_HOME_COMMUNITY_ID_NO_PREFIX,
  MetriportError,
  ORGANIZATION_NAME_DEFAULT as metriportOrganization,
  replyTo,
} from "@metriport/shared";
import { buildDayjs } from "@metriport/shared/common/date";
import { XMLBuilder } from "fast-xml-parser";
import { wrapIdInUrnUuid } from "../../../../../../util/urn";
import { mapFhirToIheGender } from "../../../../shared";
import { expiresIn, namespaces } from "../../../constants";
import { doesGatewayUseSha1, getInitiatorOid, requiresUrnInSoapBody } from "../../../gateways";
import { createSecurityHeader } from "../../../saml/security/security-header";
import { signFullSaml } from "../../../saml/security/sign";
import { SamlCertsAndKeys } from "../../../saml/security/types";
import { getQueryByParameterFromIti55RequestXml, timestampToSoapBody } from "../../../utils";

const action = "urn:hl7-org:v3:PRPA_IN201305UV02:CrossGatewayPatientDiscovery";

export type SignedXcpdRequest = {
  gateway: XCPDGateway;
  signedRequest: string;
  /** The queryByParameter XML portion of the SOAP body for audit logging */
  queryByParameterXml: string;
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
  const patientName = patientNames?.[0];
  return {
    [`urn:PRPA_IN201305UV02`]: {
      "@_xmlns:urn": namespaces.hl7,
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
            "@_root": receiverDeviceId, // TODO: 1847 - Maybe need to remove if we send spatial/state-level queries
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
                "@_root": receiverDeviceId, // TODO: 1847 - Maybe need to remove if we send spatial/state-level queries
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
            ...(patientGender !== "UNK" && {
              [`${prefix}livingSubjectAdministrativeGender`]: {
                [`${prefix}value`]: {
                  "@_code": patientGender,
                  "@_codeSystem": "2.16.840.1.113883.5.1",
                },
                [`${prefix}semanticsText`]: "LivingSubject.administrativeGender",
              },
            }),
            [`${prefix}livingSubjectBirthTime`]: patientBirthtime
              ? {
                  [`${prefix}value`]: {
                    "@_value": patientBirthtime,
                  },
                  [`${prefix}semanticsText`]: "LivingSubject.birthTime",
                }
              : {},
            ...(identifiers && identifiers.length > 0
              ? {
                  [`${prefix}livingSubjectId`]: {
                    [`${prefix}value`]: identifiers.map(identifier => ({
                      "@_extension": identifier.value,
                      "@_root": identifier.system,
                    })),
                    [`${prefix}semanticsText`]: "LivingSubject.id",
                  },
                }
              : {}),
            ...(patientName && {
              [`${prefix}livingSubjectName`]: {
                [`${prefix}value`]: {
                  [`${prefix}family`]: patientName.family,
                  [`${prefix}given`]: patientName.given,
                },
                [`${prefix}semanticsText`]: "LivingSubject.name",
              },
            }),
            ...(patientAddresses
              ? {
                  [`${prefix}patientAddress`]: {
                    [`${prefix}value`]: patientAddresses.map(address => ({
                      ...(address.line &&
                        address.line.length > 0 && {
                          [`${prefix}streetAddressLine`]: address.line,
                        }),
                      [`${prefix}city`]: address.city,
                      [`${prefix}state`]: address.state,
                      [`${prefix}postalCode`]: address.postalCode,
                      [`${prefix}country`]: address.country,
                    })),
                    [`${prefix}semanticsText`]: "Patient.addr",
                  },
                }
              : {}),
            ...(patientTelecoms && patientTelecoms.length > 0
              ? {
                  [`${prefix}patientTelecom`]: {
                    [`${prefix}value`]: patientTelecoms.map(telecom => ({
                      "@_use": telecom.system,
                      "@_value": telecom.value,
                    })),
                    [`${prefix}semanticsText`]: "Patient.telecom",
                  },
                }
              : {}),
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
    throw new MetriportError("Gateway is required to build ITI-55 Request body");
  }
  const messageId = `urn:uuid:${bodyData.id}`;
  const receiverDeviceId = gateway.oid;
  const toUrl = gateway.url;
  const providerId = bodyData.principalCareProviderIds[0];
  const homeCommunityId = getInitiatorOid(gateway, bodyData.samlAttributes);
  const patientGender = mapFhirToIheGender(bodyData.patientResource.gender);
  const patientBirthtime = timestampToSoapBody(bodyData.patientResource.birthDate, "YYYYMMDD");
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

export function createITI55SoapEnvelope({
  bodyData,
  publicCert,
}: {
  bodyData: OutboundPatientDiscoveryReq;
  publicCert: string;
}): string {
  const gateway = bodyData.gateways?.[0];
  if (!gateway) {
    throw new MetriportError("Gateway is required to build ITI-55 Request body");
  }
  const messageId = wrapIdInUrnUuid(bodyData.id);
  const toUrl = gateway.url;
  const gatewayOid = gateway.oid;
  const initiatorOid = getInitiatorOid(gateway, bodyData.samlAttributes);
  const homeCommunityId = METRIPORT_HOME_COMMUNITY_ID_NO_PREFIX;
  const initiatorName = bodyData.samlAttributes.organization;
  const purposeOfUse = bodyData.samlAttributes.purposeOfUse;
  const createdTimestamp = buildDayjs().toISOString();
  const expiresTimestamp = buildDayjs(createdTimestamp).add(expiresIn, "minute").toISOString();
  const securityHeader = createSecurityHeader({
    publicCert,
    createdTimestamp,
    expiresTimestamp,
    toUrl,
    purposeOfUse,
    gatewayOid,
    homeCommunityId,
    initiatorOid,
    initiatorName,
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

export type SigningResult =
  | { success: true; signedRequest: SignedXcpdRequest }
  | {
      success: false;
      gateway: XCPDGateway;
      outboundRequest: OutboundPatientDiscoveryReq;
      error: string;
    };

export function createAndSignBulkXcpdRequests(
  bulkBodyData: OutboundPatientDiscoveryReq,
  samlCertsAndKeys: SamlCertsAndKeys
): SigningResult[] {
  const requests: SigningResult[] = [];

  for (const gateway of bulkBodyData.gateways) {
    const bodyData: OutboundPatientDiscoveryReq = {
      ...bulkBodyData,
      gateways: [gateway],
    };

    try {
      const xmlString = createITI55SoapEnvelope({
        bodyData,
        publicCert: samlCertsAndKeys.publicCert,
      });
      const queryByParameterXml = getQueryByParameterFromIti55RequestXml(xmlString);
      const useSha1 = doesGatewayUseSha1(gateway.oid);
      const signedRequest = signFullSaml({ xmlString, samlCertsAndKeys, useSha1 });
      requests.push({
        success: true,
        signedRequest: {
          gateway,
          signedRequest,
          queryByParameterXml,
          outboundRequest: bodyData,
        },
      });
    } catch (error) {
      requests.push({
        success: false,
        gateway,
        outboundRequest: bodyData,
        error: errorToString(error),
      });
    }
  }

  return requests;
}

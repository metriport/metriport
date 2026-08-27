import {
  InboundPatientDiscoveryReq,
  InboundPatientDiscoveryResp,
  isSuccessfulInboundPatientDiscoveryResponse,
} from "@metriport/ihe-gateway-sdk";
import { MetriportError, METRIPORT_HOME_COMMUNITY_ID_NO_PREFIX } from "@metriport/shared";
import { normalizePhoneNumber } from "@metriport/shared/domain/contact/phone";
import { XMLBuilder } from "fast-xml-parser";
import { v4 as uuidv4 } from "uuid";
import { wrapIdInUrnUuid } from "../../../../../../util/urn";
import { mapFhirGenderToAdministrativeGenderCode } from "../../../../../fhir/patient/conversion";
import { namespaces } from "../../../constants";
import { ackCodes, queryResponseCodes, xmlBuilderAttributes } from "../../../shared";
import { timestampToSoapBody } from "../../../utils";
import { createSecurityHeader } from "../../shared";

function createSubjectAndRegistrationEvent(response: InboundPatientDiscoveryResp): object {
  const externalGatewayPatient = response.externalGatewayPatient;
  const patientResource = isSuccessfulInboundPatientDiscoveryResponse(response)
    ? response.patientResource
    : undefined;

  if (!patientResource) {
    throw new MetriportError("patientResource is missing in the response");
  }
  if (!externalGatewayPatient) {
    throw new MetriportError("externalGatewayPatient is missing in the response");
  }
  const phoneNumbers = patientResource.telecom?.flatMap(t => {
    if (!t.value) return [];

    const normalized = normalizePhoneNumberToEhexFormat(t.value);
    if (!normalized) return [];

    return {
      "@_use": "HP", // TODO: 1593 - Dynamically set this value
      "@_value": normalized,
    };
  });

  const subject = {
    "@_typeCode": "SUBJ",
    "@_contextConductionInd": "false",
    registrationEvent: {
      "@_classCode": "REG",
      "@_moodCode": "EVN",
      statusCode: {
        "@_code": "active",
      },
      subject1: {
        "@_typeCode": "SBJ",
        patient: {
          "@_classCode": "PAT",
          id: {
            "@_extension": externalGatewayPatient.id,
            "@_root": externalGatewayPatient.system,
          },
          statusCode: {
            "@_code": "active",
          },
          patientPerson: {
            "@_classCode": "PSN",
            "@_determinerCode": "INSTANCE",
            name: patientResource.name.map(n => ({
              family: n.family,
              given: n.given,
            })),
            ...(phoneNumbers && { telecom: phoneNumbers }),
            administrativeGenderCode: {
              "@_code": mapFhirGenderToAdministrativeGenderCode(patientResource.gender),
            },
            birthTime: {
              "@_value": timestampToSoapBody(patientResource.birthDate, "YYYYMMDD"),
            },
            addr: patientResource.address?.map(a => ({
              streetAddressLine: a.line?.join(", "),
              city: a.city,
              state: a.state,
              postalCode: a.postalCode,
              country: a.country,
            })),
          },
          providerOrganization: {
            "@_classCode": "ORG",
            "@_determinerCode": "INSTANCE",
            id: {
              "@_root": METRIPORT_HOME_COMMUNITY_ID_NO_PREFIX,
            },
            contactParty: {
              "@_classCode": "CON",
              telecom: {
                "@_value": "mailto:support@metriport.com", // TODO: 1593 - Is this ok to be hardcoded like this?
              },
            },
          },
          subjectOf1: {
            queryMatchObservation: {
              "@_xmlns:xsi": namespaces.xsi,
              "@_classCode": "COND",
              "@_moodCode": "EVN",
              code: {
                "@_code": "IHE_PDQ",
              },
              value: {
                "@_xmlns:xsi": namespaces.xsi,
                "@_xsi:type": "INT",
                "@_value": "100", // TODO: 1593 - Dynamically set this value
              },
            },
          },
        },
      },
      custodian: {
        "@_typeCode": "CST",
        assignedEntity: {
          "@_classCode": "ASSIGNED",
          id: {
            "@_root": METRIPORT_HOME_COMMUNITY_ID_NO_PREFIX,
          },
          code: {
            "@_code": "NotHealthDataLocator",
            "@_codeSystem": "1.3.6.1.4.1.19376.1.2.27.2",
          },
        },
      },
    },
  };
  return subject;
}

export function normalizePhoneNumberToEhexFormat(phone: string): string | undefined {
  const norm = normalizePhoneNumber(phone);
  if (norm.length !== 10) return undefined;
  return `tel:+1-${norm.slice(0, 3)}-${norm.slice(3, 6)}-${norm.slice(6)}`;
}

function createAckAndQueryResponseCode(response: InboundPatientDiscoveryResp): {
  ack: string;
  queryResponseCode: string;
} {
  const queryResponseCode =
    response.patientMatch === true
      ? queryResponseCodes.OK
      : response.patientMatch === false
      ? queryResponseCodes.NF
      : queryResponseCodes.AE;
  const ack =
    response.patientMatch === true || response.patientMatch === false ? ackCodes.AA : ackCodes.AE;
  return { ack, queryResponseCode };
}

function createIti55SoapBody(
  request: InboundPatientDiscoveryReq,
  response: InboundPatientDiscoveryResp,
  queryByParameter: string
): object {
  const { ack, queryResponseCode } = createAckAndQueryResponseCode(response);
  const subject = response.patientMatch ? createSubjectAndRegistrationEvent(response) : undefined;

  const soapBody = {
    PRPA_IN201306UV02: {
      "@_ITSVersion": "XML_1.0",
      "@_xmlns": "urn:hl7-org:v3",
      "@_xmlns:xsi": namespaces.xsi,
      id: {
        "@_root": uuidv4(), // TODO #1776 monitoring PR
      },
      creationTime: {
        "@_value": timestampToSoapBody(response.timestamp),
      },
      interactionId: {
        "@_extension": "PRPA_IN201306UV02",
        "@_root": "2.16.840.1.113883.1.6",
      },
      processingCode: {
        "@_code": "P",
      },
      processingModeCode: {
        "@_code": "T",
      },
      acceptAckCode: {
        "@_code": "NE",
      },
      sender: {
        "@_typeCode": "SND",
        device: {
          "@_classCode": "DEV",
          "@_determinerCode": "INSTANCE",
          id: {
            "@_root": METRIPORT_HOME_COMMUNITY_ID_NO_PREFIX,
          },
        },
      },
      receiver: {
        "@_typeCode": "RCV",
        device: {
          "@_classCode": "DEV",
          "@_determinerCode": "INSTANCE",
          id: {
            "@_root": request.samlAttributes.homeCommunityId,
          },
        },
      },
      acknowledgement: {
        typeCode: {
          "@_code": ack,
        },
        targetMessage: {
          id: {
            "@_extension": request.id,
            "@_root": request.samlAttributes.homeCommunityId,
          },
        },
        ...(response.operationOutcome && {
          acknowledgementDetail: {
            "@_typeCode": "E",
            code: (() => {
              const coding = response.operationOutcome?.issue?.[0]?.details?.coding?.[0];
              return coding?.code && coding?.system
                ? { "@_code": coding.code, "@_codeSystem": coding.system }
                : undefined;
            })(),
            text: response.operationOutcome?.issue?.[0]?.details?.text,
          },
        }),
      },
      controlActProcess: {
        "@_classCode": "CACT",
        "@_moodCode": "EVN",
        code: {
          "@_code": "PRPA_TE201306UV02",
          "@_codeSystem": "2.16.840.1.113883.1.6",
        },
        subject,
        queryByParameter,
        queryAck: {
          queryId: {
            "@_extension": request.id,
            "@_root": request.samlAttributes.homeCommunityId,
          },
          statusCode: {
            "@_code": "deliveredResponse",
          },
          queryResponseCode: {
            "@_code": queryResponseCode,
          },
        },
      },
    },
  };
  return soapBody;
}

export function createInboundXcpdResponse({
  request,
  response,
  queryByParameter,
}: {
  request: InboundPatientDiscoveryReq;
  response: InboundPatientDiscoveryResp;
  queryByParameter: string;
}): string {
  const securityHeader = createSecurityHeader({
    signatureConfirmation: response.signatureConfirmation,
  });
  const soapBody = createIti55SoapBody(request, response, queryByParameter);

  const soapEnvelope = {
    "soap:Envelope": {
      "@_xmlns:soap": namespaces.soap,
      "@_xmlns:wsa": namespaces.wsa,
      "soap:Header": {
        ...securityHeader,
        "wsa:Action": {
          "#text": "urn:hl7-org:v3:PRPA_IN201306UV02:CrossGatewayPatientDiscovery",
          "@_mustUnderstand": "1",
        },
        "wsa:RelatesTo": request.id,
        "wsa:MessageID": wrapIdInUrnUuid(uuidv4()), // TODO #1776 track this in monitoring
      },
      "soap:Body": soapBody,
    },
  };

  const builder = new XMLBuilder(xmlBuilderAttributes);
  const xmlContent = builder.build(soapEnvelope);
  return xmlContent;
}

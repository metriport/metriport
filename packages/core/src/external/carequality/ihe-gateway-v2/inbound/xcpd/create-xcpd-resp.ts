import { XMLBuilder } from "fast-xml-parser";
import dayjs from "dayjs";
import {
  InboundPatientDiscoveryResp,
  InboundPatientDiscoveryReq,
  InboundPatientDiscoveryRespSuccess,
} from "@metriport/ihe-gateway-sdk";
import { namespaces, expiresIn } from "../../constants";
import { timestampToSoapBody } from "../../utils";
import { uuidv7 } from "../../../../../util/uuid-v7";
import { METRIPORT_HOME_COMMUNITY_ID_NO_PREFIX } from "../../../shared";

export enum queryResponseCodes {
  OK = "OK",
  NF = "NF",
  AE = "AE",
}

export enum ackCodes {
  AA = "AA",
  AE = "AE",
}

// need the original messageId of the request
// need to return the security confirmation in the header.
// need to construct the query params again. Might need the InboundPatientDiscoveryReq to do that.
// focus on body for now

export function createSecurityHeader({
  signatureConfirmation,
}: {
  signatureConfirmation?: string | undefined;
}) {
  const createdTimestamp = dayjs().toISOString();
  const expiresTimestamp = dayjs(createdTimestamp).add(expiresIn, "minute").toISOString();
  const securityHeader = {
    "wsse:Security": {
      "@_xmlns:wsse": namespaces.wsse,
      "@_xmlns:ds": namespaces.ds,
      "@_xmlns:wsu": namespaces.wsu,
      "wsu:Timestamp": {
        "wsu:Created": createdTimestamp,
        "wsu:Expires": expiresTimestamp,
      },
      SignatureConfirmation: {
        "@_xmlns": namespaces.wss,
        SignatureValue: signatureConfirmation,
      },
    },
  };
  return securityHeader;
}

function createQueryByParameter(request: InboundPatientDiscoveryReq): object {
  const { id, samlAttributes, patientResource } = request;

  const queryByParameter = {
    queryByParameter: {
      queryId: {
        "@_extension": id,
        "@_root": samlAttributes.homeCommunityId,
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
            "@_code": patientResource.gender,
            "@_codeSystem": "2.16.840.1.113883.5.1",
          },
          semanticsText: "LivingSubject.administrativeGender",
        },
        livingSubjectBirthTime: patientResource.birthDate
          ? {
              value: {
                "@_value": patientResource.birthDate,
              },
              semanticsText: "LivingSubject.birthTime",
            }
          : {},
        livingSubjectId: patientResource.identifier
          ? {
              value: patientResource.identifier.map(identifier => ({
                "@_extension": identifier.value,
                "@_root": identifier.system,
              })),
              semanticsText: "LivingSubject.id",
            }
          : {},
        livingSubjectName: patientResource.name
          ? {
              value: patientResource.name.map(name => ({
                family: name.family,
                ...name.given?.reduce((acc: { [key: string]: string }, givenName: string) => {
                  acc.given = givenName;
                  return acc;
                }, {}),
              })),
              semanticsText: "LivingSubject.name",
            }
          : {},
        patientAddress: patientResource.address
          ? {
              value: patientResource.address.map(address => ({
                streetAddressLine: address.line?.join(", "),
                city: address.city,
                state: address.state,
                postalCode: address.postalCode,
                country: address.country,
              })),
              semanticsText: "Patient.addr",
            }
          : {},
        patientTelecom: patientResource.telecom
          ? {
              value: patientResource.telecom.map(telecom => ({
                "@_use": telecom.system,
                "@_value": telecom.value,
              })),
              semanticsText: "Patient.telecom",
            }
          : {},
      },
    },
  };
  return queryByParameter;
}

function isSuccessfulPatientDiscoveryResponse(
  response: InboundPatientDiscoveryResp
): response is InboundPatientDiscoveryRespSuccess {
  return "patientResource" in response;
}

function createSubjectAndRegistrationEvent(response: InboundPatientDiscoveryResp): object {
  const externalGatewayPatient = response.externalGatewayPatient;
  const patientResource = isSuccessfulPatientDiscoveryResponse(response)
    ? response.patientResource
    : undefined;
  if (!patientResource) {
    throw new Error("patientResource is missing in the response");
  }
  if (!externalGatewayPatient) {
    throw new Error("externalGatewayPatient is missing in the response");
  }
  const subject = {
    "@_typeCode": "SBJ",
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
          statusCode: "active",
          patientPerson: {
            "@_classCode": "PSN",
            "@_determinerCode": "INSTANCE",
            name: patientResource.name.map(n => ({
              family: n.family,
              ...n.given?.reduce((acc: { [key: string]: string }, givenName: string) => {
                acc.given = givenName;
                return acc;
              }, {}),
            })),
            telecom: patientResource.telecom?.map(t => ({
              "@_use": t.system,
              "@_value": t.value,
            })),
            administrativeGenderCode: {
              "@_code": patientResource.gender, // this needs to be not in FHIR but in IHE
            },
            birthTime: patientResource.birthDate, // this needs to be in right format
            addr: patientResource.address?.map(a => ({
              streetAddressLine: a.line?.join(", "),
              city: a.city,
              state: a.state,
              postalCode: a.postalCode,
              country: a.country,
            })),
          },
        },
      },
    },
  };
  return subject;
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
  response: InboundPatientDiscoveryResp
): object {
  const { ack, queryResponseCode } = createAckAndQueryResponseCode(response);
  const queryByParameter = createQueryByParameter(request);
  const subject = response.patientMatch ? createSubjectAndRegistrationEvent(response) : {};

  const soapBody = {
    "@_xmlns:urn": namespaces.hl7,
    PRPA_IN201306UV02: {
      id: {
        "@_root": uuidv7(), // change this if we ever end up keeping track of these. s
      },
      creationTime: timestampToSoapBody(response.timestamp),
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
        "@_code": "AL",
      },
      queryResponseCode: {
        "@_code": queryResponseCode,
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
      },
      controlActProcess: {
        "@_classCode": "CACT",
        "@_moodCode": "EVN",
        code: {
          "@_code": "PRPA_TE201306UV02",
          "@_codeSystem": "2.16.840.1.113883.1.6",
        },
        authorOrPerformer: {
          assignedDevice: {
            id: {
              "@_root": METRIPORT_HOME_COMMUNITY_ID_NO_PREFIX,
            },
          },
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

export function createIti55SoapEnvelopeInboundResponse({
  request,
  response,
}: {
  request: InboundPatientDiscoveryReq;
  response: InboundPatientDiscoveryResp;
}): string {
  const securityHeader = createSecurityHeader({
    signatureConfirmation: response.signatureConfirmation,
  });
  const soapBody = createIti55SoapBody(request, response);

  const soapEnvelope = {
    "soap:Envelope": {
      "@_xmlns:soap": namespaces.soap,
      "soap:Header": {
        ...securityHeader,
        "wsa:Action": {
          "#text": "urn:hl7-org:v3:PRPA_IN201306UV02:CrossGatewayPatientDiscovery",
          "@_mustUnderstand": "1",
        },
        "wsa:RelatesTo": response.id,
      },
      "soap:Body": soapBody,
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

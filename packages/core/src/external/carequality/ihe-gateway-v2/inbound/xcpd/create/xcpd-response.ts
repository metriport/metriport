import { XMLBuilder } from "fast-xml-parser";
import { v4 as uuidv4 } from "uuid";
import {
  InboundPatientDiscoveryResp,
  InboundPatientDiscoveryReq,
  isSuccessfulInboundPatientDiscoveryResponse,
} from "@metriport/ihe-gateway-sdk";
import { createSecurityHeader } from "../../shared";
import { queryResponseCodes, ackCodes, xmlBuilderAttributes } from "../../../shared";
import { namespaces } from "../../../constants";
import { timestampToSoapBody } from "../../../utils";
import { METRIPORT_HOME_COMMUNITY_ID_NO_PREFIX } from "../../../../shared";
import { mapFhirToMetriportGender } from "../../../../../fhir/patient/conversion";

function createQueryByParameter(request: InboundPatientDiscoveryReq): object {
  const { id, samlAttributes, patientResource } = request;

  const queryByParameter = {
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
  };
  return queryByParameter;
}

function createSubjectAndRegistrationEvent(response: InboundPatientDiscoveryResp): object {
  const externalGatewayPatient = response.externalGatewayPatient;
  const patientResource = isSuccessfulInboundPatientDiscoveryResponse(response)
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
              "@_code": mapFhirToMetriportGender(patientResource.gender),
            },
            birthTime: {
              "@_value": patientResource.birthDate,
            },
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
      custodian: {
        "@_typeCode": "CST",
        assignedCustodian: {
          "@_typeCode": "CST",
        },
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
  const subject = response.patientMatch ? createSubjectAndRegistrationEvent(response) : undefined;

  const soapBody = {
    "@_xmlns": namespaces.hl7,
    "@_xmlns:xsd": namespaces.xs,
    "@_xmlns:xsi": namespaces.xsi,
    PRPA_IN201306UV02: {
      id: {
        "@_root": uuidv4(), // TODO #1776 monitoring PR
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
            code: response.operationOutcome?.issue?.[0]?.details?.coding?.[0]
              ? {
                  "@_code": response.operationOutcome.issue[0].details?.coding[0].code,
                  "@_codeSystem": response.operationOutcome.issue[0].details.coding[0].system,
                }
              : undefined,
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

export function createInboundXcpdResponse({
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
      "@_xmlns:wsa": namespaces.wsa,
      "soap:Header": {
        ...securityHeader,
        "wsa:Action": {
          "#text": "urn:hl7-org:v3:PRPA_IN201306UV02:CrossGatewayPatientDiscovery",
          "@_mustUnderstand": "1",
        },
        "wsa:RelatesTo": request.id,
      },
      "soap:Body": soapBody,
    },
  };

  const builder = new XMLBuilder(xmlBuilderAttributes);
  const xmlContent = builder.build(soapEnvelope);
  return xmlContent;
}

import { AuditEvent, AuditEventAgent } from "@medplum/fhirtypes";
import { isHttpOK } from "@metriport/shared";
import { buildDayjs } from "@metriport/shared/common/date";
import { metriportCompanyDetails } from "@metriport/shared/domain/metriport";
import { stringToBase64 } from "@metriport/shared/util/base64";
import { getEhexServiceOwnUrls } from "../../external/ehex/ehex-gateway/shared";
import { METRIPORT_STRUCTURE_DEFINITION_DURATION_MS } from "../../external/fhir/shared/extensions/date-time";
import { wrapIdInUrnUuidIfMissing, wrapOidInUrnOidIfMissing } from "../../util/urn";
import {
  AUDIT_EVENT_HUMAN_USER_TYPE_SYSTEM,
  AUDIT_EVENT_TYPE_SYSTEM,
  buildBaseAuditEvent,
  createCodeableConcept,
  getNetworkAgentExtensionOptional,
  getOutcomeCode,
  HL7_AUDIT_ENTITY_TYPE_SYSTEM,
  URI_SYSTEM,
  UUID_SYSTEM,
} from "../build-audit-event-base";
import { AuditEventAction, NetworkAccessPoint, NetworkAccessPointTypeCode } from "../types";
import { InboundPatientDiscoveryAuditData, OutboundPatientDiscoveryAuditData } from "./ihe-types";
import { getSubjectRoleFromSamlAttributes, mapNhinSamlToFhir, SYSTEM_ROOT_OID } from "./shared";

// TODO ENG-1601 Use METRIPORT_HOME_COMMUNITY_ID instead of SYSTEM_ROOT_OID

export function buildInboundPatientDiscoveryAuditEvent(
  data: InboundPatientDiscoveryAuditData & { appInstanceId: string }
): AuditEvent {
  const {
    appInstanceId,
    initiatorAddress,
    destinationAddress,
    serviceName: serviceNameParam,
    serviceOid: serviceOidParam,
    networkName,
    request,
    response,
    startTime: startTimeParam,
    endTime: endTimeParam,
    statusCode,
    outcomeDesc,
    query,
  } = data;
  const serviceName = serviceNameParam ?? metriportCompanyDetails.name;
  const serviceOid = wrapOidInUrnOidIfMissing(serviceOidParam ?? SYSTEM_ROOT_OID);
  const responderHomeCommunityId = serviceOid;
  const success = isHttpOK(statusCode);
  const outcomeCode = getOutcomeCode(success, statusCode);
  const startTime =
    startTimeParam ??
    (request.timestamp ? buildDayjs(request.timestamp).toDate() : buildDayjs().toDate());
  const endTime = endTimeParam ?? buildDayjs().toDate();
  const durationMs = buildDayjs(endTime).diff(buildDayjs(startTime), "milliseconds");
  const initiatorHomeCommunityId = request.samlAttributes.homeCommunityId;
  const initiatorHuman = request.samlAttributes.subjectId;
  const initiatorName =
    request.samlAttributes.wsaFrom ??
    request.samlAttributes.replyTo ??
    request.samlAttributes.userId ??
    initiatorHomeCommunityId;
  const encodedPatientId = response?.patientId;
  const patientMatch = response?.patientMatch;
  const patientId = response?.externalGatewayPatient?.id;
  const requestId = wrapIdInUrnUuidIfMissing(request.id);
  const patientIdentifier = request.patientResource?.identifier?.[0];
  const queryAsBase64 = stringToBase64(query);
  const subjectRole = getSubjectRoleFromSamlAttributes(request.samlAttributes);
  const purposeOfUse = mapNhinSamlToFhir(request.samlAttributes.purposeOfUse);

  const description = "Inbound ITI-55 Patient Discovery";
  const baseEvent = buildBaseAuditEvent({
    transactionType: "ITI-55",
    direction: "inbound",
    action: AuditEventAction.Execute,
    recordedAt: endTime.toISOString(),
    serviceName,
    outcome: outcomeCode,
    outcomeDesc: outcomeDesc ?? (success ? "Success" : `Failed with ${statusCode}`),
    purposeOfUse,
  });

  return {
    ...baseEvent,
    period: {
      start: startTime.toISOString(),
      end: endTime.toISOString(),
    },
    agent: [
      ...buildSourceAgent({
        appInstanceId: initiatorHomeCommunityId,
        initiatorName,
        initiatorHuman,
        initiatorAddress,
        networkName,
        subjectRole,
      }),
      buildDestinationAgent({
        serviceName,
        serviceOid,
        destinationAddress,
        appInstanceId,
      }),
    ],
    entity: [
      ...(patientId
        ? [
            {
              type: {
                system: HL7_AUDIT_ENTITY_TYPE_SYSTEM,
                code: "1",
                display: "Person",
              },
              what: {
                identifier: {
                  system: patientIdentifier?.system ?? SYSTEM_ROOT_OID,
                  value: patientIdentifier?.value ?? patientId,
                },
              },
              role: {
                system: "http://terminology.hl7.org/CodeSystem/object-role",
                code: "1",
                display: "Patient",
              },
              ...(encodedPatientId
                ? {
                    detail: [
                      {
                        type: "externalGatewayPatientId",
                        valueString: encodedPatientId,
                      },
                    ],
                  }
                : {}),
            },
          ]
        : []),
      {
        type: {
          system: HL7_AUDIT_ENTITY_TYPE_SYSTEM,
          code: "2",
          display: "System Object",
        },
        what: {
          identifier: {
            system: UUID_SYSTEM,
            value: requestId,
          },
        },
        role: {
          system: "http://terminology.hl7.org/CodeSystem/object-role",
          code: "24",
          display: "Query",
        },
        query: queryAsBase64,
        description,
        detail: [
          {
            type: "ihe:homeCommunityID",
            valueString: responderHomeCommunityId,
          },
          {
            type: "patientMatch",
            valueString: patientMatch ? "true" : "false",
          },
        ],
        extension: [
          {
            url: METRIPORT_STRUCTURE_DEFINITION_DURATION_MS,
            valueInteger: durationMs,
          },
        ],
      },
    ],
  };
}

export function buildOutboundPatientDiscoveryAuditEvent(
  data: OutboundPatientDiscoveryAuditData & { appInstanceId: string }
): AuditEvent {
  const {
    appInstanceId,
    request,
    isPatientMatch,
    initiatorAddress: initiatorAddressParam,
    patientId,
    serviceName: serviceNameParam,
    networkName,
    cxId,
    startTime: startTimeParam,
    endTime: endTimeParam,
    durationMs: durationMsParam,
    query,
    statusCode,
    outcome,
  } = data;
  const ehexOrgUrls = getEhexServiceOwnUrls();
  const serverXcpdAddress = ehexOrgUrls.urlXcpd;
  const initiatorAddress =
    initiatorAddressParam ??
    (serverXcpdAddress
      ? {
          type: NetworkAccessPointTypeCode.DnsName,
          address: serverXcpdAddress,
        }
      : undefined);
  const serviceName = serviceNameParam ?? metriportCompanyDetails.name;
  const initiatorHomeCommunityId = request.outboundRequest.samlAttributes.homeCommunityId;
  const initiatorHuman = request.outboundRequest.samlAttributes.subjectId;
  const initiatorName =
    request.outboundRequest.samlAttributes.wsaFrom ??
    request.outboundRequest.samlAttributes.replyTo ??
    request.outboundRequest.samlAttributes.userId ??
    initiatorHomeCommunityId;
  const destinationOid = request.gateway.oid;
  const destinationHomeCommunityId = request.gateway.id;
  const gatewayUrl = request.gateway.url;
  const destinationAddress = {
    type: NetworkAccessPointTypeCode.DnsName,
    address: gatewayUrl,
  };
  const outcomeCode = statusCode ? getOutcomeCode(isPatientMatch ?? false, statusCode) : outcome;
  const startTime =
    startTimeParam ??
    (request.outboundRequest.timestamp
      ? buildDayjs(request.outboundRequest.timestamp).toDate()
      : buildDayjs().toDate());
  const endTime = endTimeParam ?? buildDayjs().toDate();
  const durationMs =
    durationMsParam ?? buildDayjs(endTime).diff(buildDayjs(startTime), "milliseconds");
  const requestId = wrapIdInUrnUuidIfMissing(request.outboundRequest.id);
  const queryAsBase64 = stringToBase64(query);
  const purposeOfUse = mapNhinSamlToFhir(request.outboundRequest.samlAttributes.purposeOfUse);
  const subjectRole = getSubjectRoleFromSamlAttributes(request.outboundRequest.samlAttributes);

  const description = "Outbound ITI-55 Patient Discovery Response";
  const baseEvent = buildBaseAuditEvent({
    transactionType: "ITI-55",
    direction: "outbound",
    action: AuditEventAction.Execute,
    outcome: outcomeCode,
    outcomeDesc: isPatientMatch ? "Success" : "Failed",
    recordedAt: endTime.toISOString(),
    serviceName,
    cxId,
    purposeOfUse,
  });

  const patientIdentifier = request.outboundRequest.patientResource?.identifier?.[0];

  return {
    ...baseEvent,
    period: {
      start: startTime.toISOString(),
      end: endTime.toISOString(),
    },
    agent: [
      ...buildSourceAgent({
        initiatorName,
        initiatorDisplay: serviceName,
        initiatorHuman,
        initiatorAddress,
        appInstanceId,
        subjectRole,
      }),
      buildDestinationAgent({
        networkName,
        serviceOid: destinationOid,
        destinationAddress,
        appInstanceId: initiatorHomeCommunityId,
      }),
    ],
    entity: [
      {
        type: {
          system: HL7_AUDIT_ENTITY_TYPE_SYSTEM,
          code: "1",
          display: "Person",
        },
        what: {
          identifier: {
            system: patientIdentifier?.system ?? SYSTEM_ROOT_OID,
            value: patientIdentifier?.value ?? patientId,
          },
        },
        role: {
          system: "http://terminology.hl7.org/CodeSystem/object-role",
          code: "1",
          display: "Patient",
        },
      },
      {
        type: {
          system: HL7_AUDIT_ENTITY_TYPE_SYSTEM,
          code: "2",
          display: "System Object",
        },
        what: {
          identifier: {
            system: UUID_SYSTEM,
            value: requestId,
          },
        },
        role: {
          system: "http://terminology.hl7.org/CodeSystem/object-role",
          code: "24",
          display: "Query",
        },
        query: queryAsBase64,
        description,
        detail: [
          {
            type: "ihe:homeCommunityID",
            valueString: destinationHomeCommunityId,
          },
          {
            type: "patientMatch",
            valueString: isPatientMatch ? "true" : "false",
          },
        ],
        extension: [
          {
            url: METRIPORT_STRUCTURE_DEFINITION_DURATION_MS,
            valueInteger: durationMs,
          },
        ],
      },
    ],
  };
}

/**
 * For now, we're not representing the actual user/human who requested the event (requestor), so
 * we're using the client application as the source agent.
 */
function buildSourceAgent({
  networkName,
  initiatorName,
  initiatorDisplay,
  initiatorHuman,
  initiatorAddress,
  appInstanceId,
  subjectRole,
}: {
  networkName?: string | undefined;
  initiatorName: string | undefined;
  initiatorDisplay?: string | undefined;
  initiatorHuman: string | undefined;
  initiatorAddress: NetworkAccessPoint | undefined;
  appInstanceId?: string | undefined;
  subjectRole: { code: string; display: string; system: string };
}): AuditEventAgent[] {
  const hasUserDescriptor = !!initiatorHuman;

  return [
    buildSourceAgentGateway({
      networkName,
      initiatorName,
      initiatorDisplay,
      initiatorAddress,
      appInstanceId,
    }),
    ...(hasUserDescriptor ? [buildSourceAgentHumanRequestor({ initiatorHuman, subjectRole })] : []),
  ];
}

function buildSourceAgentGateway({
  networkName,
  initiatorName,
  initiatorDisplay,
  initiatorAddress,
  appInstanceId,
  requestor = true,
}: {
  networkName?: string | undefined;
  initiatorName: string | undefined;
  initiatorDisplay?: string | undefined;
  initiatorAddress: NetworkAccessPoint | undefined;
  /**
   * Inbound: The external server's Home Community ID.
   * Outbound: ID of the app instance processing the request.
   */
  appInstanceId?: string | undefined;
  requestor?: boolean;
}): AuditEventAgent {
  return {
    type: createCodeableConcept({
      system: AUDIT_EVENT_TYPE_SYSTEM,
      code: "110153",
      display: "Source",
    }),
    ...(initiatorName || initiatorDisplay
      ? {
          who: {
            ...(initiatorName
              ? {
                  identifier: {
                    system: URI_SYSTEM,
                    value: initiatorName,
                  },
                }
              : {}),
            ...(initiatorDisplay ? { display: initiatorDisplay } : {}),
          },
        }
      : {}),
    requestor,
    ...(appInstanceId ? { altId: appInstanceId } : {}),
    ...(initiatorAddress
      ? {
          network: {
            address: initiatorAddress.address,
            type: initiatorAddress.type,
          },
        }
      : {}),
    ...getNetworkAgentExtensionOptional(networkName),
  };
}

function buildSourceAgentHumanRequestor({
  initiatorHuman,
  subjectRole,
}: {
  initiatorHuman: string;
  subjectRole: { code: string; display: string; system: string };
}): AuditEventAgent {
  return {
    type: createCodeableConcept({
      system: AUDIT_EVENT_HUMAN_USER_TYPE_SYSTEM,
      code: "IRCP",
      display: "Information Recipient",
    }),
    who: {
      identifier: {
        system: URI_SYSTEM,
        value: initiatorHuman,
      },
    },
    requestor: true,
    ...(subjectRole
      ? {
          role: [
            {
              coding: [
                {
                  system: wrapOidInUrnOidIfMissing(subjectRole.system),
                  code: subjectRole.code,
                  display: subjectRole.display,
                },
              ],
            },
          ],
        }
      : {}),
  };
}

function buildDestinationAgent({
  networkName,
  serviceName,
  serviceOid,
  destinationAddress,
  appInstanceId,
}: {
  networkName?: string | undefined;
  serviceName?: string | undefined;
  serviceOid: string;
  destinationAddress: NetworkAccessPoint | undefined;
  /**
   * Inbound: ID of the app instance processing the request.
   * Outbound: The external server's Home Community ID.
   */
  appInstanceId?: string | undefined;
}): AuditEventAgent {
  return {
    type: createCodeableConcept({
      system: AUDIT_EVENT_TYPE_SYSTEM,
      code: "110152",
      display: "Destination",
    }),
    who: {
      identifier: {
        system: URI_SYSTEM,
        value: serviceOid,
      },
      ...(serviceName ? { display: serviceName } : {}),
    },
    requestor: false,
    ...(appInstanceId ? { altId: appInstanceId } : {}),
    ...(destinationAddress
      ? {
          network: {
            address: destinationAddress.address,
            type: destinationAddress.type,
          },
        }
      : {}),
    ...getNetworkAgentExtensionOptional(networkName),
  };
}

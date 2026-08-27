import { AuditEvent, AuditEventAgent } from "@medplum/fhirtypes";
import { isSuccessfulOutboundDocQueryResponse } from "@metriport/ihe-gateway-sdk";
import { isHttpOK } from "@metriport/shared";
import { buildDayjs } from "@metriport/shared/common/date";
import { metriportCompanyDetails } from "@metriport/shared/domain/metriport";
import { iheFindDocumentOperationId } from "../../external/ehex/ehex-gateway/outbound/xca/create/iti38-envelope";
import { getEhexServiceOwnUrls } from "../../external/ehex/ehex-gateway/shared";
import { METRIPORT_STRUCTURE_DEFINITION_DURATION_MS } from "../../external/fhir/shared/extensions/date-time";
import { DOCUMENT_COUNT_EXTENSION_URL } from "../../external/fhir/shared/extensions/document";
import { formatIdAsHl7v2 } from "../../external/hie-shared/ids";
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
import { InboundDocumentQueryAuditData, OutboundDocumentQueryAuditData } from "./ihe-types";
import {
  externalGatewayPatientIdDetailType,
  getSubjectRoleFromSamlAttributes,
  mapNhinSamlToFhir,
  operationOutcomeToAuditEventEntity,
  SYSTEM_ROOT_OID,
} from "./shared";

export function buildInboundDocumentQueryAuditEvent(
  data: InboundDocumentQueryAuditData & { appInstanceId: string }
): AuditEvent {
  const {
    appInstanceId,
    initiatorAddress,
    destinationAddress,
    serviceName: serviceNameParam,
    serviceOid: serviceOidParam,
    networkName,
    query,
    request,
    response,
    statusCode,
    outcomeDesc,
    startTime: startTimeParam,
    endTime: endTimeParam,
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
  const reqSamlAttributes = request.samlAttributes;
  const initiatorHuman = reqSamlAttributes.subjectId;
  const initiatorName =
    request.samlAttributes.wsaFrom ??
    request.samlAttributes.replyTo ??
    request.samlAttributes.userId ??
    initiatorHomeCommunityId;
  const cxId = response?.cxId;
  const patientId = response?.decodedPatientId;
  const encodedPatientId = response?.patientId;
  const documentCount = response?.extrinsicObjectXmls?.length ?? 0;
  const requestId = wrapIdInUrnUuidIfMissing(request.id);
  const purposeOfUse = mapNhinSamlToFhir(reqSamlAttributes.purposeOfUse);
  const subjectRole = getSubjectRoleFromSamlAttributes(reqSamlAttributes);
  const queryBase64 = query ? Buffer.from(query, "utf-8").toString("base64") : undefined;
  const operationOutcome = response?.operationOutcome;

  const baseEvent = buildBaseAuditEvent({
    transactionType: "ITI-38",
    direction: "inbound",
    action: AuditEventAction.Read,
    recordedAt: endTime.toISOString(),
    serviceName,
    outcome: outcomeCode,
    outcomeDesc:
      outcomeDesc ??
      (success ? `Success - ${documentCount} document(s) found` : `Failed with ${statusCode}`),
    cxId,
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
                  system: SYSTEM_ROOT_OID,
                  value: patientId,
                },
              },
              role: {
                system: "http://terminology.hl7.org/CodeSystem/object-role",
                code: "1",
                display: "Patient",
              },
              detail: [
                ...(encodedPatientId
                  ? [
                      {
                        type: externalGatewayPatientIdDetailType,
                        valueString: encodedPatientId,
                      },
                    ]
                  : []),
              ],
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
        ...(queryBase64 ? { query: queryBase64 } : {}),
        ...(responderHomeCommunityId
          ? {
              detail: [
                {
                  type: "urn:ihe:iti:xcpd:2009:homeCommunityId",
                  valueString: responderHomeCommunityId,
                },
              ],
            }
          : {}),
        extension: [
          {
            url: METRIPORT_STRUCTURE_DEFINITION_DURATION_MS,
            valueInteger: durationMs,
          },
          {
            url: DOCUMENT_COUNT_EXTENSION_URL,
            valueInteger: documentCount,
          },
        ],
      },
      ...(operationOutcome ? [operationOutcomeToAuditEventEntity(operationOutcome)] : []),
    ],
  };
}

export function buildOutboundDocumentQueryAuditEvent(
  data: OutboundDocumentQueryAuditData & { appInstanceId: string }
): AuditEvent {
  const {
    appInstanceId,
    request,
    response,
    patientId,
    cxId,
    serviceName: serviceNameParam,
    networkName,
    startTime: startTimeParam,
    endTime: endTimeParam,
    query,
    outcome,
    outcomeDesc,
  } = data;
  const ehexOrgUrls = getEhexServiceOwnUrls();
  const serverXcaAddress = ehexOrgUrls.urlDq;
  const initiatorAddress = serverXcaAddress
    ? {
        type: NetworkAccessPointTypeCode.DnsName,
        address: serverXcaAddress,
      }
    : undefined;
  const serviceName = serviceNameParam ?? metriportCompanyDetails.name;
  const success = response ? isSuccessfulOutboundDocQueryResponse(response) : false;
  const startTime = startTimeParam ?? buildDayjs().toDate();
  const endTime = endTimeParam ?? buildDayjs().toDate();
  const durationMs = buildDayjs(endTime).diff(buildDayjs(startTime), "milliseconds");
  const gatewayOid = request.gateway.homeCommunityId;
  const gatewayUrl = request.gateway.url;
  const queryId = wrapIdInUrnUuidIfMissing(iheFindDocumentOperationId);
  const documentCount =
    response && response.documentReference
      ? Array.isArray(response.documentReference)
        ? response.documentReference.length
        : 0
      : 0;
  const initiatorHomeCommunityId = request.outboundRequest.samlAttributes.homeCommunityId;
  const initiatorHuman = request.outboundRequest.samlAttributes.subjectId;
  const initiatorName =
    request.outboundRequest.samlAttributes.wsaFrom ??
    request.outboundRequest.samlAttributes.replyTo ??
    request.outboundRequest.samlAttributes.userId ??
    initiatorHomeCommunityId;
  const destinationOid = gatewayOid;
  const destinationHomeCommunityId = request.gateway.homeCommunityId;
  const destinationAddress = {
    type: NetworkAccessPointTypeCode.DnsName,
    address: gatewayUrl,
  };
  const purposeOfUse = mapNhinSamlToFhir(request.outboundRequest.samlAttributes.purposeOfUse);
  const subjectRole = getSubjectRoleFromSamlAttributes(request.outboundRequest.samlAttributes);
  const externalPatientId = request.outboundRequest.externalGatewayPatient.id;
  const externalPatientIdAsH7v2 = formatIdAsHl7v2({
    patientId: externalPatientId,
    assignAuthority: destinationHomeCommunityId,
  });
  const queryBase64 = query ? Buffer.from(query, "utf-8").toString("base64") : undefined;
  const operationOutcome = response?.operationOutcome;

  const baseEvent = buildBaseAuditEvent({
    transactionType: "ITI-38",
    direction: "outbound",
    action: AuditEventAction.Read,
    outcome,
    outcomeDesc:
      outcomeDesc ?? (success ? `Success - ${documentCount} document(s) found` : "Failed"),
    recordedAt: endTime.toISOString(),
    serviceName,
    cxId,
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
            system: SYSTEM_ROOT_OID,
            value: patientId,
          },
        },
        role: {
          system: "http://terminology.hl7.org/CodeSystem/object-role",
          code: "1",
          display: "Patient",
        },
        detail: [
          {
            type: "externalGatewayPatientId",
            valueString: externalPatientIdAsH7v2,
          },
        ],
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
            value: queryId,
          },
        },
        role: {
          system: "http://terminology.hl7.org/CodeSystem/object-role",
          code: "24",
          display: "Query",
        },
        ...(queryBase64 ? { query: queryBase64 } : {}),
        detail: [
          {
            type: "urn:ihe:iti:xcpd:2009:homeCommunityId",
            valueString: initiatorHomeCommunityId,
          },
        ],
        extension: [
          {
            url: METRIPORT_STRUCTURE_DEFINITION_DURATION_MS,
            valueInteger: durationMs,
          },
          {
            url: DOCUMENT_COUNT_EXTENSION_URL,
            valueInteger: documentCount,
          },
        ],
      },
      ...(operationOutcome ? [operationOutcomeToAuditEventEntity(operationOutcome)] : []),
    ],
  };
}

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
      requestor: !hasUserDescriptor,
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
  requestor,
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
  requestor: boolean;
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

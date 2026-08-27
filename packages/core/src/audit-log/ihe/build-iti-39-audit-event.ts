import { AuditEvent, AuditEventAgent, AuditEventEntity } from "@medplum/fhirtypes";
import {
  DocumentReference,
  isSuccessfulInboundDocRetrievalResponse,
  isSuccessfulOutboundDocRetrievalResponse,
} from "@metriport/ihe-gateway-sdk";
import { buildDayjs } from "@metriport/shared/common/date";
import { metriportCompanyDetails } from "@metriport/shared/domain/metriport";
import { getEhexServiceOwnUrls } from "../../external/ehex/ehex-gateway/shared";
import { formatIdAsHl7v2 } from "../../external/hie-shared/ids";
import { wrapOidInUrnOidIfMissing } from "../../util/urn";
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
import { InboundDocumentRetrievalAuditData, OutboundDocumentRetrievalAuditData } from "./ihe-types";
import {
  externalGatewayPatientIdDetailType,
  getSubjectRoleFromSamlAttributes,
  mapNhinSamlToFhir,
  SYSTEM_ROOT_OID,
} from "./shared";

/**
 * Critical Note on ITI-39 Participant Roles:
 *
 * Unlike Query transactions (e.g., ITI-38, ITI-55) where the Source is the system initiating the
 * request (the "Client"), ITI-39 is classified as an Import/Export event tracking the flow of document
 * data. In this context, ATNA roles are assigned based on the direction of the file transfer, not the
 * HTTP request.
 *
 * Therefore, for ITI-39:
 * - The Source (110153) is the Responding Gateway (Server), as it holds the data being exported.
 * - The Destination (110152) is the Initiating Gateway (Client), as it imports/receives the data.
 *
 * Ensure your mapping logic reflects this inversion: the local system is the Destination when acting
 * as an Initiator (Import), and the Source when acting as a Responder (Export).
 */

export function buildInboundDocumentRetrievalAuditEvent(
  data: InboundDocumentRetrievalAuditData & { appInstanceId: string }
): AuditEvent {
  const {
    appInstanceId,
    initiatorAddress,
    destinationAddress,
    request,
    response,
    serviceName: serviceNameParam,
    serviceOid: serviceOidParam,
    networkName,
    statusCode,
    outcomeDesc,
    startTime: startTimeParam,
    endTime: endTimeParam,
  } = data;
  const serviceName = serviceNameParam ?? metriportCompanyDetails.name;
  const serviceOid = wrapOidInUrnOidIfMissing(serviceOidParam ?? SYSTEM_ROOT_OID);
  const success = response ? isSuccessfulInboundDocRetrievalResponse(response) : false;
  const outcomeCode = getOutcomeCode(success, statusCode);
  const startTime =
    startTimeParam ??
    (request.timestamp ? buildDayjs(request.timestamp).toDate() : buildDayjs().toDate());
  const endTime = endTimeParam ?? buildDayjs().toDate();
  // TODO ENG-1601 Try to store this in the AuditEvent object, likely as a query entity like DQ does, but check
  // mapDocumentReferenceToAuditEventEntity as it also has a comment about it
  // const durationMs = buildDayjs(endTime).diff(buildDayjs(startTime), "milliseconds");
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
  const documentCount = response?.documentReference?.length ?? 0;
  // TODO ENG-1601 Try to store the request ID in the AuditEvent object
  // const requestId = request.id;
  const purposeOfUse = mapNhinSamlToFhir(reqSamlAttributes.purposeOfUse);
  const subjectRole = getSubjectRoleFromSamlAttributes(reqSamlAttributes);
  const documentReferences = response?.documentReference;

  const baseEvent = buildBaseAuditEvent({
    transactionType: "ITI-39",
    direction: "inbound",
    action: AuditEventAction.Read,
    recordedAt: endTime.toISOString(),
    serviceName,
    outcome: outcomeCode,
    outcomeDesc:
      outcomeDesc ??
      (success
        ? `Success - ${documentCount} document(s) retrieved`
        : `Failed to retrieve documents`),
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
      ...buildIti39DestinationAgent({
        appInstanceId: initiatorHomeCommunityId,
        initiatorName,
        initiatorHuman,
        initiatorAddress,
        networkName,
        subjectRole,
      }),
      buildIti39SourceAgent({
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
      ...(documentReferences?.map(mapDocumentReferenceToAuditEventEntity) ?? []),
      // TODO ENG-1601 Removing this because now it's resulting in error on the ATNA XML output. Tried adding a filter to remove
      // entities with `typeCode === "2" && roleCode === "3"`.
      // ...(operationOutcome ? [operationOutcomeToAuditEventEntity(operationOutcome)] : []),
    ],
  };
}

function mapDocumentReferenceToAuditEventEntity(
  documentReference: DocumentReference
): AuditEventEntity {
  const documentUniqueId = documentReference.docUniqueId;
  const repositoryUniqueId = documentReference.repositoryUniqueId;
  const initiatorHomeCommunityId = documentReference.homeCommunityId;
  return {
    type: {
      system: HL7_AUDIT_ENTITY_TYPE_SYSTEM,
      code: "2",
      display: "System Object",
    },
    what: {
      identifier: {
        system: UUID_SYSTEM,
        value: documentUniqueId,
      },
    },
    role: {
      system: "http://terminology.hl7.org/CodeSystem/object-role",
      code: "3",
      display: "Report",
    },
    detail: [
      {
        type: "Repository Unique Id",
        valueString: repositoryUniqueId,
      },
      {
        type: "ihe:homeCommunityID",
        valueString: initiatorHomeCommunityId,
      },
    ],
    // TODO ENG-1601 Add duration extension
    // extension: [
    //   {
    //     url: METRIPORT_STRUCTURE_DEFINITION_DURATION_MS,
    //     valueInteger: durationMs,
    //   },
    // ],
  };
}

export function buildOutboundDocumentRetrievalAuditEvent(
  data: OutboundDocumentRetrievalAuditData & { appInstanceId: string }
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
    outcome,
    outcomeDesc,
  } = data;
  const ehexOrgUrls = getEhexServiceOwnUrls();
  const serverXcaAddress = ehexOrgUrls.urlDr;
  const initiatorAddress = serverXcaAddress
    ? {
        type: NetworkAccessPointTypeCode.DnsName,
        address: serverXcaAddress,
      }
    : undefined;
  const serviceName = serviceNameParam ?? metriportCompanyDetails.name;
  const success = response ? isSuccessfulOutboundDocRetrievalResponse(response) : false;
  const startTime = startTimeParam ?? buildDayjs().toDate();
  const endTime = endTimeParam ?? buildDayjs().toDate();
  // TODO ENG-1601 Try to store this in the AuditEvent object
  // const durationMs = buildDayjs(endTime).diff(buildDayjs(startTime), "milliseconds");
  // TODO ENG-1601 Try to store this in the AuditEvent object
  // const requestId = request.id;
  const documentReferences = response?.documentReference ?? [];
  const documentCount = documentReferences.length;
  const samlAttributes = request.outboundRequest.samlAttributes;
  const initiatorHomeCommunityId = samlAttributes.homeCommunityId;
  const initiatorHuman = samlAttributes.subjectId;
  const initiatorName =
    samlAttributes.wsaFrom ??
    samlAttributes.replyTo ??
    samlAttributes.userId ??
    initiatorHomeCommunityId;
  const destinationHomeCommunityId = request.gateway.homeCommunityId;
  const destinationOid = destinationHomeCommunityId;
  const gatewayUrl = request.gateway.url;
  const destinationAddress = gatewayUrl
    ? {
        type: NetworkAccessPointTypeCode.DnsName,
        address: gatewayUrl,
      }
    : undefined;
  const purposeOfUse = mapNhinSamlToFhir(samlAttributes.purposeOfUse);
  const subjectRole = getSubjectRoleFromSamlAttributes(samlAttributes);
  const externalPatientId = request.outboundRequest.externalPatientId;
  const externalPatientIdAsH7v2 = externalPatientId
    ? formatIdAsHl7v2({
        patientId: externalPatientId,
        assignAuthority: destinationHomeCommunityId,
      })
    : undefined;

  const baseEvent = buildBaseAuditEvent({
    transactionType: "ITI-39",
    direction: "outbound",
    action: AuditEventAction.Create,
    outcome,
    outcomeDesc:
      outcomeDesc ??
      (success
        ? `Success - ${documentCount} document(s) retrieved`
        : "Failed to retrieve documents"),
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
      ...buildIti39DestinationAgent({
        initiatorName,
        initiatorDisplay: serviceName,
        initiatorHuman,
        initiatorAddress,
        appInstanceId,
        subjectRole,
      }),
      buildIti39SourceAgent({
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
          ...(externalPatientIdAsH7v2
            ? [
                {
                  type: "externalGatewayPatientId",
                  valueString: externalPatientIdAsH7v2,
                },
              ]
            : []),
        ],
      },
      ...(documentReferences?.map(mapDocumentReferenceToAuditEventEntity) ?? []),
      // TODO ENG-1601 Removing this because now it's resulting in error on the ATNA XML output. Tried adding a filter to remove
      // entities with `typeCode === "2" && roleCode === "3"`.
      // ...(operationOutcome ? [operationOutcomeToAuditEventEntity(operationOutcome)] : []),
    ],
  };
}

function buildIti39DestinationAgent({
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
    buildIti39DestinationAgentGateway({
      networkName,
      initiatorName,
      initiatorDisplay,
      initiatorAddress,
      appInstanceId,
      requestor: !hasUserDescriptor,
    }),
    ...(hasUserDescriptor
      ? [buildIti39DestinationAgentHumanRequestor({ initiatorHuman, subjectRole })]
      : []),
  ];
}

function buildIti39DestinationAgentGateway({
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
      code: "110152",
      display: "Destination",
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

function buildIti39DestinationAgentHumanRequestor({
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

function buildIti39SourceAgent({
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
   * Outbound: not used
   */
  appInstanceId?: string | undefined;
}): AuditEventAgent {
  return {
    type: createCodeableConcept({
      system: AUDIT_EVENT_TYPE_SYSTEM,
      code: "110153",
      display: "Source",
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

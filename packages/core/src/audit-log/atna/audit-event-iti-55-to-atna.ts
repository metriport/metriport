import { AuditEvent, AuditEventAgent, AuditEventEntity } from "@medplum/fhirtypes";
import { MetriportError } from "@metriport/shared";
import { stringToBase64 } from "@metriport/shared/util/base64";
import { XMLBuilder } from "fast-xml-parser";
import { NHIN_PURPOSE_CODE_SYSTEM } from "../../shareback/metadata/constants";
import { wrapIdInUrnUuidIfMissing } from "../../util/urn";
import { getEventDirectionCode } from "../build-audit-event-base";
import { mapFhirToNhinSaml } from "../ihe/shared";
import {
  AtnaAuditEvent,
  auditEventPatientIdToHl7v2,
  DESTINATION_ROLE_CODE,
  DESTINATION_ROLE_DISPLAY,
  mapSystemOidToName,
  QUERY_TRANSACTIONS,
  SOURCE_ROLE_CODE,
  SOURCE_ROLE_DISPLAY,
} from "./shared";

/**
 * Converts a FHIR AuditEvent for ITI-55 (Patient Discovery) to an ATNA AuditMessage.
 */
export function auditEventIti55ToAtna(auditEvent: AuditEvent): AtnaAuditEvent {
  const eventIdCode = getEventIdCode(auditEvent);
  const eventTypeCode = getEventTypeCode(auditEvent);
  const eventDirectionCode = getEventDirectionCode(auditEvent);
  const isOutbound = eventDirectionCode === "outbound";
  let eventActionCode = auditEvent.action;
  const eventDateTime = auditEvent.recorded;
  const eventOutcomeIndicator = auditEvent.outcome;

  if (!eventIdCode) throw new MetriportError("EventID is mandatory but missing from audit event");
  if (!eventTypeCode)
    throw new MetriportError("EventTypeCode is mandatory but missing from audit event");
  if (!eventActionCode) {
    throw new MetriportError("EventActionCode is mandatory but missing from audit event");
  }
  if (!eventDateTime) {
    throw new MetriportError("EventDateTime is mandatory but missing from audit event");
  }
  if (!eventOutcomeIndicator) {
    throw new MetriportError("EventOutcomeIndicator is mandatory but missing from audit event");
  }

  // Force EventActionCode to "E" for query transactions per ITI TF-2b
  if (QUERY_TRANSACTIONS.includes(eventTypeCode)) {
    eventActionCode = "E";
  }

  // Build EventIdentification with PurposeOfUse in Event section (not as ParticipantObject)
  const eventIdentification: Record<string, unknown> = {
    "@_EventActionCode": eventActionCode,
    "@_EventDateTime": eventDateTime,
    "@_EventOutcomeIndicator": eventOutcomeIndicator,
    EventID: {
      "@_csd-code": eventIdCode,
      "@_codeSystemName": getCodeSystemName(auditEvent.type?.system),
      "@_originalText": auditEvent.type?.display,
    },
    EventTypeCode: {
      "@_csd-code": eventTypeCode,
      "@_codeSystemName": getCodeSystemName(auditEvent.subtype?.[0]?.system),
      "@_originalText": auditEvent.subtype?.[0]?.display,
    },
  };

  // Add EventOutcomeDescription if present
  if (auditEvent.outcomeDesc) {
    eventIdentification.EventOutcomeDescription = auditEvent.outcomeDesc;
  }

  // NEW: PurposeOfUse belongs in EventIdentification, not as ParticipantObjectIdentification
  // The POU code must come from SAML assertion, NOT hardcoded "TREAT"
  if (auditEvent.purposeOfEvent && auditEvent.purposeOfEvent.length > 0) {
    const pouList = auditEvent.purposeOfEvent
      .map(pou => {
        const coding = pou.coding?.[0];
        if (!coding?.code) return undefined;
        const atnaPurposeOfUse = mapFhirToNhinSaml(coding.code);
        return {
          "@_csd-code": atnaPurposeOfUse.code,
          "@_codeSystemName": getCodeSystemName(atnaPurposeOfUse.system),
          "@_originalText": coding.display ?? atnaPurposeOfUse.display,
        };
      })
      .filter((p): p is NonNullable<typeof p> => p !== undefined);

    if (pouList.length > 0) {
      eventIdentification.PurposeOfUse = pouList.length === 1 ? pouList[0] : pouList;
    }
  }

  const auditMessageContent: Record<string, unknown> = {
    EventIdentification: eventIdentification,
  };

  if (!auditEvent.agent || auditEvent.agent.length === 0) {
    throw new MetriportError("At least one agent is required for ATNA audit message");
  }

  // Separate agents by role
  const destinationAgents = auditEvent.agent.filter(
    a => a.type?.coding?.[0]?.code === DESTINATION_ROLE_CODE
  );

  // Source agents are now split into three parts: gateway, organization, and human requestor
  // Gateway: has code "110153", has network.address, has initiatorName
  // Organization: has code "110153", has initiatorHomeCommunityId, no network
  // Human requestor: has code "HUMAN" or system matches human user type system
  const sourceAgents = auditEvent.agent.filter(a => a.type?.coding?.[0]?.code === SOURCE_ROLE_CODE);
  const gatewayAgent = sourceAgents.find(a => a.network?.address);
  const organizationAgent = sourceAgents.find(
    a => !a.network?.address && a.type?.coding?.[0]?.code === SOURCE_ROLE_CODE
  );
  const humanRequestorAgents = auditEvent.agent.filter(
    a =>
      a.type?.coding?.[0]?.code === "HUMAN" ||
      a.type?.coding?.[0]?.code === "IRCP" ||
      a.type?.coding?.[0]?.system ===
        "http://terminology.hl7.org/CodeSystem/v3-ParticipationType" ||
      (a.requestor === true &&
        a.type?.coding?.[0]?.code !== SOURCE_ROLE_CODE &&
        a.type?.coding?.[0]?.code !== DESTINATION_ROLE_CODE)
  );

  if (!gatewayAgent) {
    throw new MetriportError(
      "Gateway source agent (RoleIDCode 110153 with network.address) is required"
    );
  }
  if (destinationAgents.length < 1) {
    throw new MetriportError(
      `At least one Destination agent (RoleIDCode ${DESTINATION_ROLE_CODE}) is required`
    );
  }

  const activeParticipants: Record<string, unknown>[] = [];

  // Build combined Source ActiveParticipant from gateway + organization
  activeParticipants.push(buildCombinedSourceActiveParticipant(gatewayAgent));

  // Process Destination agents
  for (const agent of destinationAgents) {
    activeParticipants.push(buildActiveParticipant(agent));
  }

  // Process Human Requestor agents (only if available)
  if (isOutbound) {
    for (const agent of humanRequestorAgents) {
      activeParticipants.push(buildHumanRequestorParticipant(agent, organizationAgent));
    }
  }

  auditMessageContent.ActiveParticipant = activeParticipants;

  // AuditSourceIdentification - per DICOM specs https://dicom.nema.org/medical/dicom/current/output/html/part15.html#sect_A.5.2.1
  const auditSourceId =
    auditEvent.source?.observer?.identifier?.value ??
    auditEvent.source?.observer?.display ??
    auditEvent.source?.site ??
    "";

  const sourceType = auditEvent.source?.type;
  auditMessageContent.AuditSourceIdentification = {
    "@_AuditSourceID": auditSourceId,
    ...(sourceType && Array.isArray(sourceType) && sourceType[0]?.code
      ? {
          AuditSourceTypeCode: {
            "@_csd-code": sourceType[0].code,
            "@_codeSystemName": "DCM",
            "@_originalText": sourceType[0].display,
          },
        }
      : {}),
  };

  // Process entities - for Initiator audit log, typically only Query entity (not Patient)
  // Patient entity is for Responder audit log
  if (auditEvent.entity && auditEvent.entity.length > 0) {
    const entityObjects = auditEvent.entity
      .filter(entity => {
        // Filter out report entities and patient entities for outbound/initiator flows
        // Patient entities should only be included in inbound/responder flows
        const typeCode = entity.type?.code;
        const roleCode = entity.role?.code;
        const isReportEntity = typeCode === "2" && roleCode === "3";
        if (isReportEntity) return false;
        const isPatientEntity = typeCode === "1" && roleCode === "1";
        if (isOutbound && isPatientEntity) return false;
        return true;
      })
      .map(entity => buildParticipantObject(entity, eventTypeCode, auditEvent, isOutbound))
      .filter((e): e is NonNullable<typeof e> => e !== undefined);

    if (entityObjects.length > 0) {
      auditMessageContent.ParticipantObjectIdentification = entityObjects;
    }
  }

  const builder = new XMLBuilder({
    format: true,
    ignoreAttributes: false,
    attributeNamePrefix: "@_",
    suppressEmptyNode: true,
    suppressBooleanAttributes: false,
  });

  const xmlContent = builder.build({
    AuditMessage: auditMessageContent,
  });

  return `<?xml version="1.0" encoding="UTF-8"?>\n${xmlContent}`;
}

/**
 * Extracts domain name from a URL if it's a full URL, otherwise returns the address as-is.
 */
function extractDomainFromAddress(address: string): string {
  if (!address) return address;

  // If it contains "://", it's likely a URL - extract the hostname
  if (address.includes("://")) {
    try {
      const url = new URL(address);
      return url.hostname;
    } catch {
      // If URL parsing fails, try to extract manually
      const match = address.match(/^[^:]+:\/\/([^/]+)/);
      if (match && match[1]) {
        return match[1];
      }
    }
  }

  return address;
}

/**
 * Builds a combined ActiveParticipant element for Source agents.
 * Combines gateway (initiatorName + initiatorAddress) and organization (initiatorHomeCommunityId).
 */
function buildCombinedSourceActiveParticipant(
  gatewayAgent: AuditEventAgent
): Record<string, unknown> {
  // UserID should be the initiatorName from gateway
  const userId = gatewayAgent.who?.identifier?.value ?? gatewayAgent.who?.display ?? "";

  // NetworkAccessPointID should be DNS name or IP address (NOT full URI)
  // Extract domain name if it's a URL
  const rawNetworkAddress = gatewayAgent.network?.address ?? "";
  const networkAddress = extractDomainFromAddress(rawNetworkAddress);
  const networkType = gatewayAgent.network?.type;

  // Validate network type matches address format
  const inferredNetworkType = inferNetworkAccessPointType(networkAddress);
  const finalNetworkType =
    networkType === "1" || networkType === "2" ? networkType : inferredNetworkType;

  if (!networkAddress) {
    throw new MetriportError(
      "Gateway source agent requires network.address (DNS name or IP address, NOT full URI)"
    );
  }

  const isRequestor = gatewayAgent.requestor ? "true" : "false";

  const activeParticipant: Record<string, unknown> = {
    "@_UserID": userId,
    "@_UserIsRequestor": isRequestor,
    "@_NetworkAccessPointID": networkAddress,
    "@_NetworkAccessPointTypeCode": finalNetworkType,
    RoleIDCode: {
      "@_csd-code": SOURCE_ROLE_CODE,
      "@_codeSystemName": "DCM",
      "@_originalText": SOURCE_ROLE_DISPLAY,
    },
  };

  /**
   * AlternativeUserID should be: process ID as used within the local operating system in the local system logs.
   * Each client populates this based on it's own architecture:
   * - ECS: process ID or task ID if available
   * - Lambda: invocation ID
   */
  const alternativeUserId = getAlternativeUserId(gatewayAgent);
  if (alternativeUserId) {
    activeParticipant["@_AlternativeUserID"] = alternativeUserId;
  }

  return activeParticipant;
}

/**
 * Builds an ActiveParticipant element for Source or Destination agents.
 */
function buildActiveParticipant(agent: AuditEventAgent): Record<string, unknown> {
  const isRequestor = agent.requestor === true;
  const roleIdCode = agent.type?.coding?.[0]?.code;
  // By default true since this function is only called for destination agents.
  const isDestination = roleIdCode ? roleIdCode === DESTINATION_ROLE_CODE : true;
  const role = isDestination ? "destination" : "source";

  // NetworkAccessPointID should be DNS name or IP address (NOT full URI)
  // Extract domain if full URL was provided
  const rawNetworkAddress = agent.network?.address ?? "";
  const networkAddress = extractDomainFromAddress(rawNetworkAddress);
  if (!networkAddress) {
    throw new MetriportError(
      `${role} agent requires network.address (DNS name or IP address, NOT full URI)`
    );
  }

  // UserID should be the SOAP endpoint URI
  const userId = isDestination
    ? rawNetworkAddress
    : agent.who?.identifier?.value ?? agent.who?.display ?? "";

  // NetworkAccessPointTypeCode: "1" for DNS name, "2" for IP address
  // ATNA only allows "1" or "2" - ignore FHIR network.type if it's anything else
  const networkType = agent.network?.type;
  const inferredNetworkType = inferNetworkAccessPointType(networkAddress);
  const finalNetworkType =
    networkType === "1" || networkType === "2" ? networkType : inferredNetworkType;

  const activeParticipant: Record<string, unknown> = {
    "@_UserID": userId,
    "@_UserIsRequestor": isRequestor ? "true" : "false",
    "@_NetworkAccessPointID": networkAddress,
    "@_NetworkAccessPointTypeCode": finalNetworkType,
  };

  /**
   * AlternativeUserID should be: process ID as used within the local operating system in the local system logs.
   * Each client populates this based on it's own architecture:
   * - ECS: process ID or task ID if available
   * - Lambda: invocation ID
   */
  const alternativeUserId = getAlternativeUserId(agent);
  if (alternativeUserId) {
    activeParticipant["@_AlternativeUserID"] = alternativeUserId;
  }

  if (roleIdCode) {
    activeParticipant.RoleIDCode = {
      "@_csd-code": roleIdCode,
      "@_codeSystemName": "DCM",
      "@_originalText": isDestination ? DESTINATION_ROLE_DISPLAY : SOURCE_ROLE_DISPLAY,
    };
  }

  return activeParticipant;
}

/**
 * Builds an ActiveParticipant element for Human Requestor.
 * This is required if available from SAML subject-id attribute.
 */
function buildHumanRequestorParticipant(
  agent: AuditEventAgent,
  organizationAgent: AuditEventAgent | undefined
): Record<string, unknown> {
  // UserID should be the initiatorHuman (from SAML subject-id)
  const userId = agent.who?.identifier?.value ?? agent.who?.display ?? "";

  if (!userId) {
    throw new MetriportError(
      "Human requestor agent requires who.identifier.value (from SAML subject-id)"
    );
  }

  // AlternativeUserID should be the initiatorHomeCommunityId from organization agent
  const alternativeUserId = organizationAgent?.who?.identifier?.value ?? "";

  // Use subjectRole from agent.role if available, otherwise fall back to default human user role
  const subjectRoleCoding = agent.role?.[0]?.coding?.[0];
  const roleCode = subjectRoleCoding?.code ?? "human";
  const roleSystem = subjectRoleCoding?.system
    ? mapSystemOidToName(subjectRoleCoding?.system)
    : undefined;
  const roleDisplay = subjectRoleCoding?.display ?? "Human User";
  const roleCodeSystemName = roleSystem ? getCodeSystemName(roleSystem) : "DCM";

  const activeParticipant: Record<string, unknown> = {
    "@_UserID": userId,
    "@_UserIsRequestor": "true",
    RoleIDCode: {
      "@_csd-code": roleCode,
      "@_codeSystemName": roleCodeSystemName,
      "@_originalText": roleDisplay,
    },
  };

  // Add AlternativeUserID if organization agent provides it
  if (alternativeUserId) {
    activeParticipant["@_AlternativeUserID"] = alternativeUserId;
  }

  return activeParticipant;
}

/**
 * Builds a ParticipantObjectIdentification element for ITI-55.
 * ITI-55 query entities require the 'query' field with base64-encoded QueryByParameter XML.
 */
function buildParticipantObject(
  entity: AuditEventEntity,
  eventTypeCode: string,
  auditEvent: AuditEvent,
  isOutbound: boolean
): Record<string, unknown> | undefined {
  const typeCode = entity.type?.code;
  const roleCode = entity.role?.code;

  const isPatientEntity = typeCode === "1" && roleCode === "1";
  const isQueryEntity = typeCode === "2" && (roleCode === "24" || roleCode === "20");
  if (isPatientEntity && isQueryEntity) {
    throw new MetriportError("Patient and Query entities cannot be combined");
  }

  // Build the participant object
  const participantObject: Record<string, unknown> = {};

  if (isOutbound && isPatientEntity) return;
  if (!isOutbound && isPatientEntity) {
    // Patient entity - format ID as CX
    // For inbound/responder flows, use the external gateway patient ID if available
    const patientId = auditEventPatientIdToHl7v2(entity, true);
    participantObject["@_ParticipantObjectID"] = patientId;
    participantObject["@_ParticipantObjectTypeCode"] = "1";
    participantObject["@_ParticipantObjectTypeCodeRole"] = "1";
    participantObject.ParticipantObjectIDTypeCode = {
      "@_csd-code": "2",
      "@_codeSystemName": "RFC-3881",
      "@_originalText": "Patient Number",
    };
    return participantObject;
  }

  if (isQueryEntity) {
    // Query entity for ITI-55 - requires query field
    const queryId = entity.what?.identifier?.value ?? entity.what?.display ?? "";
    participantObject["@_ParticipantObjectID"] = wrapIdInUrnUuidIfMissing(queryId);
    participantObject["@_ParticipantObjectTypeCode"] = "2";
    participantObject["@_ParticipantObjectTypeCodeRole"] = "24";
    participantObject.ParticipantObjectIDTypeCode = {
      "@_csd-code": eventTypeCode,
      "@_codeSystemName": "IHE Transactions",
      "@_originalText": auditEvent.subtype?.[0]?.display ?? eventTypeCode,
    };

    // ParticipantObjectQuery is mandatory for ITI-55 - should be base64-encoded QueryByParameter XML
    if (!entity.query) {
      throw new MetriportError(
        "ITI-55 query entity requires 'query' field containing base64-encoded QueryByParameter XML from ITI-55 message"
      );
    }
    participantObject.ParticipantObjectQuery = entity.query;

    // ParticipantObjectDetail is mandatory for ITI-55
    if (entity.detail && entity.detail.length > 0) {
      const details = entity.detail.flatMap(detail => {
        if (detail.type === "patientMatch") return [];

        // Use the full URN for homeCommunityId per IHE ITI TF-2b spec
        let detailType = detail.type;
        if (detailType?.toLowerCase().includes("homecommunityid")) {
          detailType = "ihe:homeCommunityId";
        }

        const value =
          detail.valueBase64Binary ??
          (detail.valueString ? stringToBase64(detail.valueString) : undefined);

        if (!value) return [];

        return {
          "@_type": detailType,
          ...(value ? { "@_value": value } : {}),
        };
      });

      if (details.length > 0) {
        participantObject.ParticipantObjectDetail = details;
      }
    }

    if (!participantObject.ParticipantObjectDetail) {
      throw new MetriportError("ITI-55 query entity requires at least one ParticipantObjectDetail");
    }
    return participantObject;
  }

  // Other entity types
  const objectId =
    entity.what?.identifier?.value ?? entity.what?.display ?? entity.what?.reference ?? "";
  participantObject["@_ParticipantObjectID"] = wrapIdInUrnUuidIfMissing(objectId);

  if (typeCode) {
    participantObject["@_ParticipantObjectTypeCode"] = normalizeParticipantObjectTypeCode(typeCode);
  }
  if (roleCode) {
    participantObject["@_ParticipantObjectTypeCodeRole"] =
      normalizeParticipantObjectTypeCodeRole(roleCode);
  }

  if (entity.what?.identifier?.system) {
    participantObject.ParticipantObjectIDTypeCode = {
      "@_csd-code": entity.what.identifier.value ?? "",
      "@_codeSystemName": getCodeSystemName(entity.what.identifier.system),
      "@_originalText": entity.what.identifier.value ?? "",
    };
  }

  if (entity.name) {
    participantObject.ParticipantObjectName = entity.name;
  }

  return participantObject;
}

/**
 * Gets AlternativeUserID from agent.altId (process ID).
 * altId can be a string or an array of Identifier objects.
 */
function getAlternativeUserId(agent: AuditEventAgent): string | undefined {
  const altId = agent.altId;
  if (!altId) return undefined;

  if (typeof altId === "string") return altId;

  // Handle array of Identifier objects
  const altIdArray = altId as unknown;
  if (Array.isArray(altIdArray) && altIdArray.length > 0) {
    const firstAltId = altIdArray[0];
    if (firstAltId && typeof firstAltId === "object") {
      return (
        (firstAltId as { value?: string }).value ?? (firstAltId as { id?: string }).id ?? undefined
      );
    }
  }

  return undefined;
}

/**
 * Infers NetworkAccessPointTypeCode from address format.
 * "1" = Machine name (DNS), "2" = IP address
 */
function inferNetworkAccessPointType(address: string): string {
  if (!address) return "2";

  // Check if it's an IP address (IPv4 or IPv6)
  const ipv4Regex = /^(\d{1,3}\.){3}\d{1,3}$/;
  const ipv6Regex = /^([0-9a-fA-F]{0,4}:){2,7}[0-9a-fA-F]{0,4}$/;

  if (ipv4Regex.test(address) || ipv6Regex.test(address)) {
    return "2"; // IP address
  }

  // If it contains "://" it's a URI - extract hostname
  if (address.includes("://")) {
    console.warn(
      `NetworkAccessPointID should be DNS name or IP, not full URI: ${address}. ` +
        `Please provide just the hostname or IP address.`
    );
  }

  return "1"; // Machine name (DNS)
}

function getCodeSystemName(system: string | undefined): string {
  if (!system) return "";
  if (system === "http://terminology.hl7.org/CodeSystem/v3-ActReason") {
    return NHIN_PURPOSE_CODE_SYSTEM;
  }
  if (system.includes("dicom.nema.org") || system.includes("DCM")) return "DCM";
  if (
    system === "urn:ihe:event-type-code" ||
    system.includes("ihe.net") ||
    system.includes("IHE")
  ) {
    return "IHE Transactions";
  }
  if (system.includes("terminology.hl7.org") || system.includes("HL7")) return "HL7";
  if (system.includes("RFC-3881") || system.includes("rfc3881")) return "RFC-3881";
  return system;
}

function getEventIdCode(auditEvent: AuditEvent): string | undefined {
  return auditEvent.type?.code;
}

function getEventTypeCode(auditEvent: AuditEvent): string | undefined {
  return auditEvent.subtype?.[0]?.code;
}

function normalizeParticipantObjectTypeCode(code: string | undefined): string | undefined {
  if (!code) return undefined;
  const num = parseInt(code, 10);
  if (!isNaN(num) && num >= 1 && num <= 4) return String(num);
  if (code === "1" || code.toLowerCase() === "person") return "1";
  if (code === "2" || code.toLowerCase() === "system object" || code.toLowerCase() === "system")
    return "2";
  if (code === "3" || code.toLowerCase() === "organization") return "3";
  if (code === "4" || code.toLowerCase() === "other") return "4";
  return "4";
}

function normalizeParticipantObjectTypeCodeRole(code: string | undefined): string | undefined {
  if (!code) return undefined;
  const num = parseInt(code, 10);
  if (!isNaN(num) && num >= 1 && num <= 24) return String(num);
  if (code === "1" || code.toLowerCase() === "patient") return "1";
  if (code === "24" || code.toLowerCase() === "query") return "24";
  return "1";
}

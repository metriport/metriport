import { AuditEvent, CodeableConcept, Coding, Extension } from "@medplum/fhirtypes";
import { AUDIT_DIRECTION_EXTENSION_URL } from "../external/fhir/shared/extensions/audit";
import { CX_ID_EXTENSION_URL } from "../external/fhir/shared/extensions/metriport";
import { NETWORK_NAME_EXTENSION_URL } from "../external/fhir/shared/extensions/network";
import { uuidv7 } from "../util/uuid-v7";
import { AuditEventAction, AuditEventOutcome, TransactionType } from "./types";

// TODO ENG-1601 Review this is needed
export const IHE_BALP_AUDIT_EVENT_PROFILE =
  "https://profiles.ihe.net/ITI/BALP/StructureDefinition/IHE.BasicAudit.Query";

export const AUDIT_EVENT_TYPE_SYSTEM = "http://dicom.nema.org/resources/ontology/DCM";
export const AUDIT_EVENT_HUMAN_USER_TYPE_SYSTEM =
  "http://terminology.hl7.org/CodeSystem/v3-ParticipationType";
export const AUDIT_EVENT_SUB_TYPE_SYSTEM = "urn:ihe:event-type-code";

export const URI_SYSTEM = "urn:ietf:rfc:3986";
export const UUID_SYSTEM = "urn:ietf:rfc:4122";

/** What kind of thing the entity is */
export const HL7_AUDIT_ENTITY_TYPE_SYSTEM =
  "http://terminology.hl7.org/CodeSystem/audit-entity-type";
/** IHE Extension for what kind of thing the entity is */
export const IHE_BALP_SYSTEM = "http://ihe.net/fhir/CodeSystem/BasicAuditEntityType";

export type Direction = "inbound" | "outbound";

type CodeAndDisplay = { code: string; display: string };

type CodeAndDisplayByDirection = Record<Direction, CodeAndDisplay>;

const typeMap: Record<TransactionType, CodeAndDisplayByDirection> = {
  "ITI-55": {
    inbound: { code: "110112", display: "Query" },
    outbound: { code: "110112", display: "Query" },
  },
  "ITI-38": {
    inbound: { code: "110112", display: "Query" },
    outbound: { code: "110112", display: "Query" },
  },
  "ITI-39": {
    inbound: { code: "110106", display: "Export" },
    outbound: { code: "110107", display: "Import" },
  },
};

const subtypeMap: Record<TransactionType, CodeAndDisplay> = {
  "ITI-55": { code: "ITI-55", display: "Cross Gateway Patient Discovery" },
  "ITI-38": { code: "ITI-38", display: "Cross Gateway Query" },
  "ITI-39": { code: "ITI-39", display: "Cross Gateway Retrieve" },
};

export function getOutcomeCode(success: boolean, statusCode?: number): AuditEventOutcome {
  if (success) {
    return AuditEventOutcome.Success;
  }
  if (statusCode && statusCode >= 500) {
    return AuditEventOutcome.MajorFailure;
  }
  if (statusCode && statusCode >= 400) {
    return AuditEventOutcome.SeriousFailure;
  }
  return AuditEventOutcome.MinorFailure;
}

export function createCodeableConcept(coding: Coding): CodeableConcept {
  return { coding: [coding] };
}

export function createCxIdExtension(cxId: string): Extension[] {
  return [
    {
      url: CX_ID_EXTENSION_URL,
      valueString: cxId,
    },
  ];
}

function isCxIdExtension(extension: Extension): boolean {
  return extension.url === CX_ID_EXTENSION_URL;
}

export function getCxIdFromAuditEvent(auditEvent: AuditEvent): string | undefined {
  return auditEvent.extension?.find(isCxIdExtension)?.valueString;
}

function getTransactionTypeCoding(transactionType: TransactionType, direction: Direction): Coding {
  const mapping = typeMap[transactionType];
  return {
    system: AUDIT_EVENT_TYPE_SYSTEM,
    code: mapping[direction].code,
    display: mapping[direction].display,
  };
}

export function getTransactionSubtypeCoding(transactionType: TransactionType): Coding {
  const mapping = subtypeMap[transactionType];
  return {
    system: AUDIT_EVENT_SUB_TYPE_SYSTEM,
    code: mapping.code,
    display: mapping.display,
  };
}

export interface BuildBaseAuditEventParams {
  /** The purpose of the event */
  purposeOfUse: {
    system: string;
    code: string;
    display: string;
  };
  /** Identifier for a family of the event. For example, a menu item, program, rule, policy, function code, application name or URL. It identifies the performed function. */
  transactionType: TransactionType;
  /** Indicator for type of action performed during the event that generated the audit. */
  action: AuditEventAction;
  /** The outcome of the audit event */
  outcome?: AuditEventOutcome;
  /** The description of the outcome */
  outcomeDesc?: string;
  /** The name of the service/system that's processing messages and using the audit system */
  serviceName: string;
  /** The date and time the audit event was recorded */
  recordedAt: string;
  /** The customer ID */
  cxId?: string | undefined;
  /** The direction of the audit event */
  direction: Direction;
}

export function buildBaseAuditEvent({
  transactionType,
  direction,
  action,
  outcome,
  outcomeDesc,
  serviceName,
  recordedAt,
  purposeOfUse,
  cxId,
}: BuildBaseAuditEventParams): AuditEvent {
  return {
    resourceType: "AuditEvent",
    id: uuidv7(),
    type: getTransactionTypeCoding(transactionType, direction),
    subtype: [getTransactionSubtypeCoding(transactionType), getDirectionSubtypeCoding(direction)],
    meta: {
      profile: [IHE_BALP_AUDIT_EVENT_PROFILE],
    },
    ...(cxId ? { extension: createCxIdExtension(cxId) } : {}),
    action,
    recorded: recordedAt,
    purposeOfEvent: [
      {
        coding: [purposeOfUse],
      },
    ],
    source: {
      observer: { display: serviceName },
      type: [
        {
          system: "http://terminology.hl7.org/CodeSystem/security-source-type",
          code: "4",
          display: serviceName + " Application Server",
        },
      ],
    },
    ...(outcome ? { outcome } : {}),
    ...(outcomeDesc ? { outcomeDesc } : {}),
  };
}

export function getDirectionSubtypeCoding(direction: Direction): Coding {
  return {
    system: AUDIT_DIRECTION_EXTENSION_URL,
    code: direction,
    display: direction === "inbound" ? "Inbound / Responding" : "Outbound / Initiating",
  };
}

export function getEventDirectionCode(auditEvent: AuditEvent): Direction | undefined {
  const direction = auditEvent.subtype?.find(s => s.system === AUDIT_DIRECTION_EXTENSION_URL)?.code;
  return direction as Direction | undefined;
}

export function getNetworkAgentExtensionOptional(networkName?: string | undefined): Extension {
  if (!networkName) return {};
  return {
    extension: [getNetworkAgentExtension(networkName)],
  };
}
export function getNetworkAgentExtension(networkName: string): Extension {
  return {
    url: NETWORK_NAME_EXTENSION_URL,
    valueString: networkName,
  };
}

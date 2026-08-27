import { AuditEvent } from "@medplum/fhirtypes";
import { Direction, AUDIT_EVENT_SUB_TYPE_SYSTEM } from "./build-audit-event-base";
import { AUDIT_DIRECTION_EXTENSION_URL } from "../external/fhir/shared/extensions/audit";
import { TransactionType } from "./types";

/**
 * Extracts the IHE transaction type from an AuditEvent.
 * Returns "ITI-55", "ITI-38", or "ITI-39" based on the event's subtype.
 *
 * @param auditEvent - The AuditEvent to extract the transaction type from
 * @returns The transaction type or undefined if not found
 */
export function getIheTransactionType(auditEvent: AuditEvent): TransactionType | undefined {
  const transactionSubtype = auditEvent.subtype?.find(
    s => s.system === AUDIT_EVENT_SUB_TYPE_SYSTEM
  );
  const code = transactionSubtype?.code;
  if (code === "ITI-55" || code === "ITI-38" || code === "ITI-39") {
    return code;
  }
  return undefined;
}

/**
 * Extracts the direction from an AuditEvent.
 * Returns "inbound" or "outbound" based on the event's subtype.
 *
 * @param auditEvent - The AuditEvent to extract the direction from
 * @returns The direction or undefined if not found
 */
export function getDirection(auditEvent: AuditEvent): Direction | undefined {
  const directionSubtype = auditEvent.subtype?.find(
    s => s.system === AUDIT_DIRECTION_EXTENSION_URL
  );
  const code = directionSubtype?.code;
  if (code === "inbound" || code === "outbound") {
    return code;
  }
  return undefined;
}

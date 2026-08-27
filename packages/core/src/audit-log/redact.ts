import { AuditEvent, AuditEventEntity } from "@medplum/fhirtypes";

const REDACTED = "[REDACTED]";

/**
 * Redacts PHI from audit events before storing them.
 * Replaces the query field (which may contain PHI in ITI-55 queries) with a redacted placeholder.
 */
export function redactPhi(auditEvent: AuditEvent): AuditEvent {
  const entities = auditEvent.entity?.map(redactEntityPhi);
  return {
    ...auditEvent,
    ...(entities ? { entity: entities } : {}),
  };
}

function redactEntityPhi(entity: AuditEventEntity): AuditEventEntity {
  if (!entity.query) return entity;

  return {
    ...entity,
    query: REDACTED,
  };
}

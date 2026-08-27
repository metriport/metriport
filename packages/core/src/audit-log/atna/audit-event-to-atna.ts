import { AuditEvent } from "@medplum/fhirtypes";
import { MetriportError } from "@metriport/shared";
import { auditEventIti38ToAtna } from "./audit-event-iti-38-to-atna";
import { auditEventIti39ToAtna } from "./audit-event-iti-39-to-atna";
import { auditEventIti55ToAtna } from "./audit-event-iti-55-to-atna";
import { AtnaAuditEvent } from "./shared";

/**
 * Converts a FHIR AuditEvent to an ATNA AuditMessage.
 * Routes to the appropriate converter based on the transaction type (ITI-55, ITI-38, or ITI-39).
 *
 * @param auditEvent - The FHIR AuditEvent to convert
 * @returns The ATNA XML string
 */
export function auditEventToAtna(auditEvent: AuditEvent): AtnaAuditEvent {
  const eventTypeCode = auditEvent.subtype?.[0]?.code;

  if (eventTypeCode === "ITI-55") {
    return auditEventIti55ToAtna(auditEvent);
  }
  if (eventTypeCode === "ITI-38") {
    return auditEventIti38ToAtna(auditEvent);
  }
  if (eventTypeCode === "ITI-39") {
    return auditEventIti39ToAtna(auditEvent);
  }

  throw new MetriportError(
    `Unsupported transaction type - supported types are: ITI-55, ITI-38, and ITI-39`,
    undefined,
    {
      eventTypeCode,
    }
  );
}

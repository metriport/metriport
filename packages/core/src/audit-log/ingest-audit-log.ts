import { AuditEvent } from "@medplum/fhirtypes";
import { capture, out } from "../util";
import { errorToString } from "../util/error/shared";
import { buildAuditLogService } from "./audit-log-factory";
import { redactPhi } from "./redact";

/**
 * Ingests an audit log event into the audit log service.
 *
 * NOTE: it swallows errors.
 *
 * @param auditEvent - The audit log event to ingest.
 * @returns A promise that resolves when the audit log event has been ingested.
 */
export async function ingestAuditLog(auditEvent: AuditEvent): Promise<void> {
  const { log } = out("ingestAuditLog");
  try {
    const auditLogService = buildAuditLogService();
    await auditLogService.ingestAuditLog(auditEvent);
  } catch (error) {
    const msg = "Error storing audit log";
    const errorAsStr = errorToString(error);
    log(`${msg}: ${errorAsStr}`);
    const redactedEvent = redactPhi(auditEvent);
    capture.error(msg, {
      extra: { auditEvent: JSON.stringify(redactedEvent), error: errorAsStr },
    });
    // intentionally swallowing the error, we don't want to impact functional logic/flows
  }
}

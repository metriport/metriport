import { AuditEvent } from "@medplum/fhirtypes";

export abstract class AuditLogService {
  abstract ingestAuditLog(auditEvent: AuditEvent): Promise<void>;
}

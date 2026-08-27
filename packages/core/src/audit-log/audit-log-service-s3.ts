import { AuditEvent } from "@medplum/fhirtypes";
import { buildDayjs } from "@metriport/shared/common/date";
import { S3Utils } from "../external/aws/s3";
import { JSON_APP_MIME_TYPE, XML_TXT_MIME_TYPE } from "../util/mime";
import { auditEventToAtna } from "./atna/audit-event-to-atna";
import { AuditLogService } from "./audit-log-service";
import { getEventDirectionCode } from "./build-audit-event-base";

const AUDIT_LOG_PREFIX = "audit-log";
const AUDIT_LOG_CONTENT_TYPE = JSON_APP_MIME_TYPE;

export class AuditLogServiceS3 extends AuditLogService {
  constructor(private readonly bucketName: string, private readonly region: string) {
    super();
  }

  async ingestAuditLog(auditEvent: AuditEvent): Promise<void> {
    // TODO ENG-1601 Leaving here for now until we decided if we really want to keep as is
    // const cxId = getCxIdFromAuditEvent(auditEvent);
    const s3Utils = new S3Utils(this.region);

    await Promise.all([
      this.uploadAuditEventJson({
        s3Utils,
        auditEvent,
      }),
      this.uploadAuditEventXml({
        s3Utils,
        auditEvent,
      }),
    ]);
  }

  async uploadAuditEventJson({
    s3Utils,
    auditEvent,
  }: {
    s3Utils: S3Utils;
    auditEvent: AuditEvent;
  }): Promise<void> {
    const key = buildS3Key(auditEvent);
    const payload = JSON.stringify(auditEvent, null, 2);
    await s3Utils.uploadFile({
      bucket: this.bucketName,
      key,
      file: Buffer.from(payload, "utf-8"),
      contentType: AUDIT_LOG_CONTENT_TYPE,
    });
  }

  async uploadAuditEventXml({
    s3Utils,
    auditEvent,
  }: {
    s3Utils: S3Utils;
    auditEvent: AuditEvent;
  }): Promise<void> {
    const key = buildS3Key(auditEvent);
    const xmlKey = key + ".xml";
    const atnaAuditEvent = auditEventToAtna(auditEvent);
    await s3Utils.uploadFile({
      bucket: this.bucketName,
      key: xmlKey,
      file: Buffer.from(atnaAuditEvent, "utf-8"),
      contentType: XML_TXT_MIME_TYPE,
    });
  }
}

function buildS3Key(auditEvent: AuditEvent): string {
  const date = buildDayjs(auditEvent.recorded ?? new Date());
  const year = date.format("YYYY");
  const month = date.format("MM");
  const day = date.format("DD");
  const hour = date.format("HH");
  const eventId = auditEvent.id ?? "unknown";
  const direction = getEventDirectionCode(auditEvent) ?? "unknown";
  return `${AUDIT_LOG_PREFIX}/year=${year}/month=${month}/day=${day}/hour=${hour}/direction=${direction}/${eventId}.json`;
}

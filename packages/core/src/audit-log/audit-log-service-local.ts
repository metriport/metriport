import { AuditEvent } from "@medplum/fhirtypes";
import { MetriportError } from "@metriport/shared";
import { buildDayjs } from "@metriport/shared/common/date";
import fs from "fs";
import path from "path";
import { auditEventToAtna } from "./atna/audit-event-to-atna";
import { AuditLogService } from "./audit-log-service";
import { getDirection, getIheTransactionType } from "./shared";

export class AuditLogServiceLocal extends AuditLogService {
  private static _folderName: string;

  constructor() {
    super();
    if (!AuditLogServiceLocal._folderName) AuditLogServiceLocal.resetFolderName();
  }

  static setFolderName(folderName: string): void {
    AuditLogServiceLocal._folderName = folderName;
  }
  static resetFolderName(): void {
    AuditLogServiceLocal._folderName = `runs/audit-log/mock-server/${timestamp()}`;
  }

  async ingestAuditLog(auditEvent: AuditEvent): Promise<void> {
    if (!AuditLogServiceLocal._folderName) {
      throw new MetriportError("Folder is not set, call setFolder() first");
    }
    await Promise.all([
      this.uploadAuditEventJson({
        folderName: AuditLogServiceLocal._folderName,
        auditEvent,
      }),
      this.uploadAuditEventXml({
        folderName: AuditLogServiceLocal._folderName,
        auditEvent,
      }),
    ]);
  }

  private async uploadAuditEventJson({
    folderName,
    auditEvent,
  }: {
    folderName: string;
    auditEvent: AuditEvent;
  }): Promise<void> {
    const transactionType = getIheTransactionType(auditEvent) ?? "unknown-transaction-type";
    const direction = getDirection(auditEvent) ?? "unknown-direction";
    const fileNameJson = `${folderName}/${direction}_${transactionType}_${timestamp()}.json`;
    initFile(fileNameJson);
    fs.writeFileSync(fileNameJson, JSON.stringify(auditEvent, null, 2));
  }

  private async uploadAuditEventXml({
    folderName,
    auditEvent,
  }: {
    folderName: string;
    auditEvent: AuditEvent;
  }): Promise<void> {
    const direction = getDirection(auditEvent) ?? "unknown-direction";
    const transactionType = getIheTransactionType(auditEvent) ?? "unknown-transaction-type";
    const atnaAuditEvent = auditEventToAtna(auditEvent);
    const fileNameXml = `${folderName}/${direction}_${transactionType}_${timestamp()}.xml`;
    initFile(fileNameXml);
    fs.writeFileSync(fileNameXml, atnaAuditEvent);
  }
}

function initFile(fileName: string, header?: string) {
  const dirName = path.dirname(fileName);
  if (!fs.existsSync(dirName)) {
    fs.mkdirSync(dirName, { recursive: true });
  }
  if (header) {
    fs.writeFileSync(fileName, header);
  }
}

function timestamp(): string {
  return buildDayjs().toISOString().replace(/T/g, "_").replace(/:/g, "-");
}

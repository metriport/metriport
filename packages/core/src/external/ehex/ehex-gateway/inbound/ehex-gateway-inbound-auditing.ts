import { errorToString, MetriportError } from "@metriport/shared";
import { buildDayjs } from "@metriport/shared/common/date";
import dayjs from "dayjs";
import duration from "dayjs/plugin/duration";
import {
  buildInboundDocumentQueryAuditEvent,
  buildInboundPatientDiscoveryAuditEvent,
  ingestAuditLog,
} from "../../../../audit-log";
import { buildInboundDocumentRetrievalAuditEvent } from "../../../../audit-log/ihe/build-iti-39-audit-event";
import {
  InboundDocumentQueryAuditData,
  InboundDocumentRetrievalAuditData,
  InboundPatientDiscoveryAuditData,
} from "../../../../audit-log/ihe/ihe-types";
import { NetworkAccessPointTypeCode, Source } from "../../../../audit-log/types";
import { out } from "../../../../util/log";
import { getEhexServiceOwnUrls } from "../shared";

dayjs.extend(duration);

export async function auditPdSafe(
  auditEventParams: Omit<
    InboundPatientDiscoveryAuditData,
    "networkName" | "destinationAddress" | "endTime"
  > & { appInstanceId: string }
) {
  const { log } = out("auditPdSafe");
  try {
    const endTime = buildDayjs().toDate();
    const { urlXcpd } = getEhexServiceOwnUrls();
    if (!urlXcpd) throw new MetriportError("Missing eHex own URLs");
    const defaultDestinationAddress = {
      type: NetworkAccessPointTypeCode.DnsName,
      address: urlXcpd,
    };
    const auditEvent = buildInboundPatientDiscoveryAuditEvent({
      ...auditEventParams,
      networkName: Source.HIE_EHEX,
      destinationAddress: defaultDestinationAddress,
      endTime,
    });
    await ingestAuditLog(auditEvent);
  } catch (error) {
    log(`Failed to ingest audit event - ${errorToString(error)}`);
    // intentionally swallowing the error
  }
}

export async function auditDqSafe(
  auditEventParams: Omit<
    InboundDocumentQueryAuditData,
    "networkName" | "destinationAddress" | "endTime"
  > & { appInstanceId: string }
) {
  const { log } = out("auditDqSafe");
  try {
    const endTime = buildDayjs().toDate();
    const { urlDq } = getEhexServiceOwnUrls();
    if (!urlDq) throw new MetriportError("Missing eHex own URLs");
    const defaultDestinationAddress = {
      type: NetworkAccessPointTypeCode.DnsName,
      address: urlDq,
    };
    const auditEvent = buildInboundDocumentQueryAuditEvent({
      ...auditEventParams,
      networkName: Source.HIE_EHEX,
      destinationAddress: defaultDestinationAddress,
      endTime,
    });
    await ingestAuditLog(auditEvent);
  } catch (error) {
    log(`Failed to ingest audit event - ${errorToString(error)}`);
    // intentionally swallowing the error
  }
}

export async function auditDrSafe(
  auditEventParams: Omit<
    InboundDocumentRetrievalAuditData,
    "networkName" | "destinationAddress" | "endTime"
  > & { appInstanceId: string }
) {
  const { log } = out("auditDrSafe");
  try {
    const endTime = buildDayjs().toDate();
    const { urlDr } = getEhexServiceOwnUrls();
    if (!urlDr) throw new MetriportError("Missing eHex own URLs");
    const defaultDestinationAddress = {
      type: NetworkAccessPointTypeCode.DnsName,
      address: urlDr,
    };
    const auditEvent = buildInboundDocumentRetrievalAuditEvent({
      ...auditEventParams,
      networkName: Source.HIE_EHEX,
      destinationAddress: defaultDestinationAddress,
      endTime,
    });
    await ingestAuditLog(auditEvent);
  } catch (error) {
    log(`Failed to ingest audit event - ${errorToString(error)}`);
    // intentionally swallowing the error
  }
}

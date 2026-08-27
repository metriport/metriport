import {
  OperationOutcome,
  OutboundDocumentQueryResp,
  OutboundDocumentRetrievalResp,
} from "@metriport/ihe-gateway-sdk";
import { errorToString } from "@metriport/shared";
import { buildDayjs } from "@metriport/shared/common/date";
import {
  buildOutboundDocumentQueryAuditEvent,
  buildOutboundDocumentRetrievalAuditEvent,
  buildOutboundPatientDiscoveryAuditEvent,
  ingestAuditLog,
} from "../../../../audit-log";
import { getOutcomeCode } from "../../../../audit-log/build-audit-event-base";
import { AuditEventOutcome, Source } from "../../../../audit-log/types";
import { out } from "../../../../util/log";
import { SignedDqRequest } from "./xca/create/iti38-envelope";
import { SignedDrRequest } from "./xca/create/iti39-envelope";
import { SignedXcpdRequest } from "./xcpd/create/iti55-envelope";

/**
 * Stores the audit log for the XCPD request.
 * IMPORTANT: it swallows the error if the audit log fails to be stored.
 */
export async function storeAuditLogForXcpd({
  request,
  isPatientMatch,
  startTime,
  appInstanceId,
  patientId,
  cxId,
  statusCode,
  operationOutcome,
}: {
  request: SignedXcpdRequest;
  isPatientMatch: boolean | undefined;
  startTime: Date;
  appInstanceId: string;
  patientId: string;
  cxId: string;
  statusCode: number;
  operationOutcome: OperationOutcome | undefined;
}): Promise<void> {
  const outcome = getOutcomeCode(isPatientMatch ?? false, statusCode);
  const outcomeDesc =
    outcome === AuditEventOutcome.Success
      ? "XCPD request sent successfully"
      : getMessageFromOperationOutcome(operationOutcome);
  try {
    const endTime = buildDayjs().toDate();
    const auditEvent = buildOutboundPatientDiscoveryAuditEvent({
      networkName: Source.HIE_EHEX,
      appInstanceId,
      cxId,
      patientId,
      query: request.queryByParameterXml,
      request,
      isPatientMatch,
      startTime,
      endTime,
      statusCode,
      outcome,
      outcomeDesc,
    });
    await ingestAuditLog(auditEvent);
  } catch (error) {
    const { log } = out(`storeAuditLogForXcpd - cxId ${cxId}`);
    const msg = errorToString(error);
    log(`Failed to store AuditEvent - ${msg}`);
    // intentionally swallowing the error
  }
}

/**
 * Stores the audit log for the DQ request.
 * IMPORTANT: it swallows the error if the audit log fails to be stored.
 */
export async function storeAuditLogForDq({
  request,
  response,
  isSuccessfulResponse,
  startTime,
  appInstanceId,
  patientId,
  cxId,
  statusCode,
  operationOutcome,
}: {
  request: SignedDqRequest;
  response: OutboundDocumentQueryResp;
  isSuccessfulResponse: boolean;
  startTime: Date;
  appInstanceId: string;
  patientId: string;
  cxId: string;
  statusCode: number;
  operationOutcome: OperationOutcome | undefined;
}): Promise<void> {
  const outcome = getOutcomeCode(isSuccessfulResponse, statusCode);
  const outcomeDesc =
    outcome === AuditEventOutcome.Success
      ? "DQ request sent successfully"
      : getMessageFromOperationOutcome(operationOutcome);
  try {
    const endTime = buildDayjs().toDate();
    const auditEvent = buildOutboundDocumentQueryAuditEvent({
      networkName: Source.HIE_EHEX,
      appInstanceId,
      cxId,
      patientId,
      query: request.xmlBody,
      request,
      response,
      startTime,
      endTime,
      outcome,
      outcomeDesc,
    });
    await ingestAuditLog(auditEvent);
  } catch (error) {
    const { log } = out(`storeAuditLogForDq - cxId ${cxId}`);
    const msg = errorToString(error);
    log(`Failed to store AuditEvent - ${msg}`);
    // intentionally swallowing the error
  }
}

/**
 * Stores the audit log for the DR request.
 * IMPORTANT: it swallows the error if the audit log fails to be stored.
 */
export async function storeAuditLogForDr({
  request,
  response,
  isSuccessfulResponse,
  startTime,
  appInstanceId,
  patientId,
  cxId,
  statusCode,
  operationOutcome,
}: {
  request: SignedDrRequest;
  response: OutboundDocumentRetrievalResp;
  isSuccessfulResponse: boolean;
  startTime: Date;
  appInstanceId: string;
  patientId: string;
  cxId: string;
  statusCode: number;
  operationOutcome: OperationOutcome | undefined;
}): Promise<void> {
  const outcome = getOutcomeCode(isSuccessfulResponse, statusCode);
  const outcomeDesc =
    outcome === AuditEventOutcome.Success
      ? "DR request sent successfully"
      : getMessageFromOperationOutcome(operationOutcome);
  try {
    const endTime = buildDayjs().toDate();
    const auditEvent = buildOutboundDocumentRetrievalAuditEvent({
      networkName: Source.HIE_EHEX,
      appInstanceId,
      cxId,
      patientId,
      request,
      response,
      startTime,
      endTime,
      outcome,
      outcomeDesc,
    });
    await ingestAuditLog(auditEvent);
  } catch (error) {
    const { log } = out(`storeAuditLogForDr - cxId ${cxId}`);
    const msg = errorToString(error);
    log(`Failed to store AuditEvent - ${msg}`);
    // intentionally swallowing the error
  }
}

function getMessageFromOperationOutcome(
  operationOutcome: OperationOutcome | undefined
): string | undefined {
  return operationOutcome?.issue?.[0]?.details?.text;
}

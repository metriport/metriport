import {
  InboundDocumentQueryReq,
  InboundDocumentQueryResp,
  InboundDocumentRetrievalReq,
  InboundDocumentRetrievalResp,
  InboundPatientDiscoveryReq,
  InboundPatientDiscoveryResp,
  OutboundDocumentQueryResp,
  OutboundDocumentRetrievalResp,
} from "@metriport/ihe-gateway-sdk";
import { SignedDqRequest } from "../../external/carequality/ihe-gateway-v2/outbound/xca/create/iti38-envelope";
import { SignedXcpdRequest } from "../../external/carequality/ihe-gateway-v2/outbound/xcpd/create/iti55-envelope";
import { SignedDrRequest } from "../../external/ehex/ehex-gateway/outbound/xca/create/iti39-envelope";
import { AuditEventOutcome, NetworkAccessPoint } from "../types";

export type InboundPatientDiscoveryAuditData = {
  initiatorAddress: NetworkAccessPoint | undefined;
  destinationAddress: NetworkAccessPoint | undefined;
  request: InboundPatientDiscoveryReq;
  response: InboundPatientDiscoveryResp | undefined;
  statusCode: number;
  /** The Metriport service name. If not provided, the service name will be the default Metriport System. */
  serviceName?: string | undefined;
  /** The Metriport root OID. If not provided, the root OID will be the default Metriport one. */
  serviceOid?: string | undefined;
  /** The 3rd party system or network */
  networkName: string;
  /** The description of the outcome */
  outcomeDesc?: string | undefined;
  /** The date and time the event being audited was processed - not when it was recorded by the audit system */
  startTime: Date;
  /** The date and time the event being audited was completed - not when it was recorded by the audit system */
  endTime: Date;
  /** The actual, unparsed query parameters/payload object (demographics, etc.) */
  query: string;
};

export type OutboundPatientDiscoveryAuditData = {
  initiatorAddress?: NetworkAccessPoint | undefined;
  request: SignedXcpdRequest;
  isPatientMatch: boolean | undefined;
  statusCode: number | undefined;
  patientId: string;
  cxId: string;
  /** The Metriport service name. If not provided, the service name will be the default Metriport System. */
  serviceName?: string | undefined;
  /** The Metriport root OID. If not provided, the root OID will be the default Metriport one. */
  serviceOid?: string | undefined;
  /** The 3rd party system or network */
  networkName: string;
  /** The outcome of the audit event */
  outcome: AuditEventOutcome;
  /** The description of the outcome */
  outcomeDesc?: string | undefined;
  /** The date and time the event being audited was processed - not when it was recorded by the audit system */
  startTime: Date;
  /** The date and time the event being audited was completed - not when it was recorded by the audit system */
  endTime: Date;
  /** How long it took for the remote server to respond - dedicated property because we have retries and start-end would be misleading */
  durationMs?: number;
  /** The queryByParameter XML from ITI-55 message (required for ATNA compliance) */
  query: string;
};

export type InboundDocumentQueryAuditData = {
  initiatorAddress: NetworkAccessPoint | undefined;
  destinationAddress: NetworkAccessPoint | undefined;
  request: InboundDocumentQueryReq;
  response?: InboundDocumentQueryResp | undefined;
  statusCode: number;
  /** The Metriport service name. If not provided, the service name will be the default Metriport System. */
  serviceName?: string | undefined;
  /** The Metriport root OID. If not provided, the root OID will be the default Metriport one. */
  serviceOid?: string | undefined;
  /** The 3rd party system or network */
  networkName: string;
  /** The date and time the event being audited was processed - not when it was recorded by the audit system */
  startTime: Date;
  endTime: Date;
  /** Base64-encoded AdhocQueryRequest XML from ITI-38 message (required for ATNA compliance) */
  query?: string | undefined;
  outcomeDesc?: string | undefined;
};

export type OutboundDocumentQueryAuditData = {
  request: SignedDqRequest;
  response: OutboundDocumentQueryResp | undefined;
  outcome: AuditEventOutcome;
  outcomeDesc?: string | undefined;
  patientId: string;
  cxId: string;
  /** The Metriport service name. If not provided, the service name will be the default Metriport System. */
  serviceName?: string | undefined;
  /** The 3rd party system or network */
  networkName: string;
  /** The date and time the event being audited was processed - not when it was recorded by the audit system */
  startTime: Date;
  endTime: Date;
  /** Base64-encoded AdhocQueryRequest XML from ITI-38 message (required for ATNA compliance) */
  query?: string | undefined;
};

export type InboundDocumentRetrievalAuditData = {
  initiatorAddress: NetworkAccessPoint | undefined;
  destinationAddress: NetworkAccessPoint | undefined;
  /** The Metriport service name. If not provided, the service name will be the default Metriport System. */
  serviceName?: string | undefined;
  /** The Metriport root OID. If not provided, the root OID will be the default Metriport one. */
  serviceOid?: string | undefined;
  /** The 3rd party system or network */
  networkName: string;
  request: InboundDocumentRetrievalReq;
  response?: InboundDocumentRetrievalResp | undefined;
  statusCode: number;
  outcomeDesc?: string | undefined;
  /** The date and time the event being audited was processed - not when it was recorded by the audit system */
  startTime: Date;
  endTime: Date;
};

export type OutboundDocumentRetrievalAuditData = {
  request: SignedDrRequest;
  response: OutboundDocumentRetrievalResp | undefined;
  outcome: AuditEventOutcome;
  outcomeDesc?: string | undefined;
  cxId: string;
  patientId: string;
  /** The Metriport service name. If not provided, the service name will be the default Metriport System. */
  serviceName?: string | undefined;
  /** The 3rd party system or network */
  networkName: string;
  /** The date and time the event being audited was processed - not when it was recorded by the audit system */
  startTime: Date;
  endTime: Date;
};

import {
  OutboundDocumentQueryResp,
  OutboundDocumentRetrievalResp,
  OutboundPatientDiscoveryResp,
} from "@metriport/ihe-gateway-sdk";
import { executeWithNetworkRetries } from "@metriport/shared";
import axios from "axios";
import { OutboundResultPoller, PollOutboundResults } from "./outbound-result-poller";
import {
  pollOutboundDocQueryResults,
  pollOutboundDocRetrievalResults,
  pollOutboundPatientDiscoveryResults,
} from "./poll-outbound-results";

const api = axios.create();

export type OutboundPatientDiscoveryRespParam = {
  patientId: string;
  cxId: string;
  requestId: string;
  results: OutboundPatientDiscoveryResp[];
};

export type OutboundDocQueryRespParam = {
  patientId: string;
  cxId: string;
  requestId: string;
  response: OutboundDocumentQueryResp[];
  queryGrantorOid: string | undefined;
  forceDownload?: boolean | undefined;
};

export type OutboundDocRetrievalRespParam = {
  patientId: string;
  cxId: string;
  requestId: string;
  results: OutboundDocumentRetrievalResp[];
};

/**
 * Direct DB access implementation of OutboundResultPoller.
 *
 * Polls the results of outbound document query and retrieval requests directly from the DB and
 * sends the results to the API.
 */
export class OutboundResultPollerDirect extends OutboundResultPoller {
  private readonly patientDiscoveryResultsUrl: string;
  private readonly docQueryResultsUrl: string;
  private readonly docRetrievalResultsUrl: string;
  readonly isValid: boolean;

  constructor(apiUrl: string, private readonly dbCreds: string) {
    super();
    try {
      new URL(apiUrl);
      this.isValid = true;
      this.patientDiscoveryResultsUrl = `${apiUrl}/internal/carequality/patient-discovery/results`;
      this.docQueryResultsUrl = `${apiUrl}/internal/carequality/document-query/results`;
      this.docRetrievalResultsUrl = `${apiUrl}/internal/carequality/document-retrieval/results`;
    } catch (error) {
      this.isValid = false;
      this.patientDiscoveryResultsUrl = `invalid`;
      this.docQueryResultsUrl = `invalid`;
      this.docRetrievalResultsUrl = `invalid`;
    }
  }

  isPDEnabled(): boolean {
    return this.isValid;
  }

  async pollOutboundPatientDiscoveryResults(params: PollOutboundResults): Promise<void> {
    if (!this.isPDEnabled()) throw new Error(`PD polling is not enabled`);
    const results = await pollOutboundPatientDiscoveryResults({
      ...params,
      dbCreds: this.dbCreds,
    });
    const { requestId, patientId, cxId } = params;

    const payload: OutboundPatientDiscoveryRespParam = {
      requestId,
      patientId,
      cxId,
      results,
    };

    // TODO not sure if should retry on timeout
    await executeWithNetworkRetries(() => api.post(this.patientDiscoveryResultsUrl, payload));
  }

  isDQEnabled(): boolean {
    return this.isValid;
  }

  async pollOutboundDocQueryResults(params: PollOutboundResults): Promise<void> {
    if (!this.isDQEnabled()) throw new Error(`DQ polling is not enabled`);
    const response = await pollOutboundDocQueryResults({
      ...params,
      dbCreds: this.dbCreds,
    });
    const { requestId, patientId, cxId, forceDownload, queryGrantorOid } = params;

    const payload: OutboundDocQueryRespParam = {
      requestId,
      patientId,
      cxId,
      response,
      queryGrantorOid,
      forceDownload,
    };

    // TODO not sure if should retry on timeout
    await executeWithNetworkRetries(() => api.post(this.docQueryResultsUrl, payload));
  }

  isDREnabled(): boolean {
    return this.isValid;
  }
  async pollOutboundDocRetrievalResults(params: PollOutboundResults): Promise<void> {
    if (!this.isDREnabled()) throw new Error(`DR polling is not enabled`);
    const results = await pollOutboundDocRetrievalResults({
      ...params,
      dbCreds: this.dbCreds,
    });
    const { requestId, patientId, cxId } = params;

    const payload: OutboundDocRetrievalRespParam = {
      requestId,
      patientId,
      cxId,
      results,
    };

    // TODO not sure if should retry on timeout
    await executeWithNetworkRetries(() => api.post(this.docRetrievalResultsUrl, payload));
  }
}

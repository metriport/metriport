import axios from "axios";
import { OutboundResultPoller, PollOutboundResults } from "./outbound-result-pooler";
import {
  pollOutboundDocQueryResults,
  pollOutboundDocRetrievalResults,
  pollOutboundPatientDiscoveryResults,
} from "./poll-outbound-results";

const api = axios.create();

/**
 * Direct DB access implementation of OutboundResultPooler.
 *
 * Polls the results of outbound document query and retrieval requests directly from the DB and
 * sends the results to the API.
 */
export class OutboundResultPoolerDirect extends OutboundResultPoller {
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
    await api.post(this.patientDiscoveryResultsUrl, {
      requestId,
      patientId,
      cxId,
      results,
    });
  }

  isDQEnabled(): boolean {
    return this.isValid;
  }

  async pollOutboundDocQueryResults(params: PollOutboundResults): Promise<void> {
    if (!this.isDQEnabled()) throw new Error(`DQ polling is not enabled`);
    const results = await pollOutboundDocQueryResults({
      ...params,
      dbCreds: this.dbCreds,
    });
    const { requestId, patientId, cxId } = params;
    await api.post(this.docQueryResultsUrl, {
      requestId,
      patientId,
      cxId,
      results,
    });
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
    await api.post(this.docRetrievalResultsUrl, {
      requestId,
      patientId,
      cxId,
      results,
    });
  }
}

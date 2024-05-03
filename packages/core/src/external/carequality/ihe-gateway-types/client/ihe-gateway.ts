import axios, { AxiosInstance } from "axios";
import dayjs from "dayjs";
import duration from "dayjs/plugin/duration";
import { OutboundDocumentQueryReq } from "../models/document-query/document-query-requests";
import { OutboundDocumentRetrievalReq } from "../models/document-retrieval/document-retrieval-requests";
import { OutboundPatientDiscoveryReq } from "../models/patient-discovery/patient-discovery-requests";

dayjs.extend(duration);

const DEFAULT_AXIOS_TIMEOUT = dayjs.duration({ minutes: 2 });

export class IHEGateway {
  private api: AxiosInstance;

  static PATIENT_DISCOVERY_ENDPOINT = "/xcpd/";
  static DOCUMENT_QUERY_ENDPOINT = "/xcadq/";
  static DOCUMENT_RETRIEVAL_ENDPOINT = "/xcadr/";

  constructor(options: { url: string; timeout?: number }) {
    this.api = axios.create({
      timeout: options.timeout ?? DEFAULT_AXIOS_TIMEOUT.milliseconds(),
      baseURL: options.url,
    });
  }

  /**
   * Patient Discovery (XCPD ITI-55) request.
   * https://profiles.ihe.net/ITI/TF/Volume2/ITI-55.html
   *
   * @param outboundPatientDiscoveryReq A patient discovery transaction request to IHE Gateway.
   *
   */
  async startPatientDiscovery(
    outboundPatientDiscoveryReq: OutboundPatientDiscoveryReq
  ): Promise<void> {
    await this.api.post(IHEGateway.PATIENT_DISCOVERY_ENDPOINT, outboundPatientDiscoveryReq);
  }

  /**
   * Query Documents (XCA-ITI-38) request.
   * https://profiles.ihe.net/ITI/TF/Volume2/ITI-38.html
   *
   * @param outboundDocumentQueryReq An array of document query transaction requests.
   *
   */
  async startDocumentsQuery({
    outboundDocumentQueryReq,
  }: {
    outboundDocumentQueryReq: OutboundDocumentQueryReq[];
  }): Promise<void> {
    await this.api.post(IHEGateway.DOCUMENT_QUERY_ENDPOINT, outboundDocumentQueryReq);
  }

  /**
   * Retrieve Documents (XCA-ITI-39) request.
   * https://profiles.ihe.net/ITI/TF/Volume2/ITI-39.html
   *
   * @param outboundDocumentRetrievalReq An array of document retrieval transaction requests.
   *
   */
  async startDocumentsRetrieval({
    outboundDocumentRetrievalReq,
  }: {
    outboundDocumentRetrievalReq: OutboundDocumentRetrievalReq[];
  }): Promise<void> {
    await this.api.post(IHEGateway.DOCUMENT_RETRIEVAL_ENDPOINT, outboundDocumentRetrievalReq);
  }
}

import axios, { AxiosInstance } from "axios";
import dayjs from "dayjs";
import duration from "dayjs/plugin/duration";
import { DocumentQueryRequest } from "../models/document-query";
import { DocumentRetrievalRequest } from "../models/document-retrieval";
import { PatientDiscoveryRequest } from "../models/patient-discovery";

dayjs.extend(duration);

const DEFAULT_AXIOS_TIMEOUT = dayjs.duration({ minutes: 2 });

export enum APIMode {
  dev = "dev",
  integration = "integration",
  production = "production",
}

export class IHEGateway {
  static productionUrl = "https://ihe.metriport.com";
  static integrationUrl = "https://ihe.staging.metriport.com";
  static devUrl = "http://host.docker.internal:8083";

  static PATIENT_DISCOVERY_ENDPOINT = "/xcpd/";
  static DOCUMENT_QUERY_ENDPOINT = "/xcadq/";
  static DOCUMENT_RETRIEVAL_ENDPOINT = "/xcadr/";

  private api: AxiosInstance;
  constructor(apiMode: APIMode, options: { timeout?: number } = {}) {
    this.api = axios.create({
      timeout: options?.timeout ?? DEFAULT_AXIOS_TIMEOUT.milliseconds(),
      baseURL:
        apiMode === APIMode.production
          ? IHEGateway.productionUrl
          : apiMode === APIMode.integration
          ? IHEGateway.integrationUrl
          : IHEGateway.devUrl,
    });
  }

  /**
   * Patient Discovery (XCPD ITI-55) request.
   * https://profiles.ihe.net/ITI/TF/Volume2/ITI-55.html
   *
   * @param pdRequest A patient discovery transaction request to IHE Gateway.
   *
   */
  async startPatientDiscovery(pdRequest: PatientDiscoveryRequest): Promise<void> {
    await this.api.post(IHEGateway.PATIENT_DISCOVERY_ENDPOINT, pdRequest);
  }

  /**
   * Query Documents (XCA-ITI-38) request.
   * https://profiles.ihe.net/ITI/TF/Volume2/ITI-38.html
   *
   * @param documentQueryRequest An array of document query transaction requests.
   *
   */
  async startDocumentsQuery({
    documentQueryRequest,
  }: {
    documentQueryRequest: DocumentQueryRequest[];
  }): Promise<void> {
    await this.api.post(IHEGateway.DOCUMENT_QUERY_ENDPOINT, documentQueryRequest);
  }

  /**
   * Retrieve Documents (XCA-ITI-39) request.
   * https://profiles.ihe.net/ITI/TF/Volume2/ITI-39.html
   *
   * @param documentRetrieval An array of document retrieval transaction requests.
   *
   */
  async startDocumentsRetrieval({
    documentRetrieval,
  }: {
    documentRetrieval: DocumentRetrievalRequest[];
  }): Promise<void> {
    await this.api.post(IHEGateway.DOCUMENT_RETRIEVAL_ENDPOINT, documentRetrieval);
  }
}

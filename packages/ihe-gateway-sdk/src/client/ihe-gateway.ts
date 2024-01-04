import axios, { AxiosInstance } from "axios";
import dayjs from "dayjs";
import duration from "dayjs/plugin/duration";
import { PatientDiscoveryRequestOutgoing } from "../models/patient-discovery";
import { DocumentQueryRequestOutgoing } from "../models/document-query";
import { DocumentRetrievalRequestOutgoing } from "../models/document-retrieval";

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
  static devUrl = "http://localhost:8082";

  static PATIENT_DISCOVERY_ENDPOINT = "/xcpd/";
  static DOCUMENT_QUERY_ENDPOINT = "/xcadq/";
  static DOCUMENT_RETRIEVAL_ENDPOINT = "/xcadr/";

  private api: AxiosInstance;
  constructor(apiMode: APIMode, options: { timeout?: number; url?: string } = {}) {
    this.api = axios.create({
      timeout: options?.timeout ?? DEFAULT_AXIOS_TIMEOUT.milliseconds(),
      baseURL:
        apiMode === APIMode.production
          ? IHEGateway.productionUrl
          : apiMode === APIMode.integration
          ? IHEGateway.integrationUrl
          : options.url ?? IHEGateway.devUrl,
    });
  }

  /**
   * Patient Discovery (XCPD ITI-55) request.
   * https://profiles.ihe.net/ITI/TF/Volume2/ITI-55.html
   *
   * @param PatientDiscoveryRequestOutgoing A patient discovery transaction request to IHE Gateway.
   *
   */
  async startPatientDiscovery(
    patientDiscoveryRequestOutgoing: PatientDiscoveryRequestOutgoing
  ): Promise<void> {
    await this.api.post(IHEGateway.PATIENT_DISCOVERY_ENDPOINT, patientDiscoveryRequestOutgoing);
  }

  /**
   * Query Documents (XCA-ITI-38) request.
   * https://profiles.ihe.net/ITI/TF/Volume2/ITI-38.html
   *
   * @param DocumentQueryRequestOutgoing An array of document query transaction requests.
   *
   */
  async startDocumentsQuery({
    documentQueryRequestOutgoing,
  }: {
    documentQueryRequestOutgoing: DocumentQueryRequestOutgoing[];
  }): Promise<void> {
    await this.api.post(IHEGateway.DOCUMENT_QUERY_ENDPOINT, documentQueryRequestOutgoing);
  }

  /**
   * Retrieve Documents (XCA-ITI-39) request.
   * https://profiles.ihe.net/ITI/TF/Volume2/ITI-39.html
   *
   * @param documentRetrieval An array of document retrieval transaction requests.
   *
   */
  async startDocumentsRetrieval({
    documentRetrievalRequestOutgoing,
  }: {
    documentRetrievalRequestOutgoing: DocumentRetrievalRequestOutgoing[];
  }): Promise<void> {
    await this.api.post(IHEGateway.DOCUMENT_RETRIEVAL_ENDPOINT, documentRetrievalRequestOutgoing);
  }
}

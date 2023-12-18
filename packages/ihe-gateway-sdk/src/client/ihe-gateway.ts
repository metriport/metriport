import { sizeInBytes } from "@metriport/core/util/string";
import axios, { AxiosInstance } from "axios";
import dayjs from "dayjs";
import duration from "dayjs/plugin/duration";
import { DocumentQueryRequest } from "../models/document-query";
import { DocumentRetrievalRequest } from "../models/document-retrieval";

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
  // static devUrl = "https://5c39-2001-569-5124-1100-19dc-6aa5-803b-233b.ngrok-free.app";
  // static devUrl = "http://ihe-gateway-up:8082";
  static devUrl = "http://192.168.1.190:8082";

  static PATIENT_DISCOVERY_ENDPOINT = "/xcpd";
  static DOCUMENT_QUERY_ENDPOINT = "/xcadq";
  static DOCUMENT_RETRIEVAL_ENDPOINT = "/xcadr";

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
   * @param patientDiscoveryRequest A patient discovery transaction request to Ihe Gateway.
   *
   */
  // async startPatientDiscovery(patientDiscoveryRequest: PatientDiscoveryRequest): Promise<void> {

  //   const size = sizeInBytes(data);
  //   console.log("SIZE", size);

  //   // Try to send the request from a different library or a stright http request
  //   await this.api.post(IHEGateway.PATIENT_DISCOVERY_ENDPOINT, data, {
  //     headers: {
  //       "Content-Type": "application/json",
  //       "Content-Length": size,
  //       Accept: "*/*",
  //       "Accept-Encoding": "gzip, deflate, br",
  //       Connection: "keep-alive",
  //     },
  //   });
  //   console.log("DONE SENDING");
  // }

  // async startPatientDiscovery(patientDiscoveryRequest: PatientDiscoveryRequest): Promise<void> {
  async startPatientDiscovery(): Promise<void> {
    const data = `{
      "x": "5",
      "y": "6"
    }`;

    const size = sizeInBytes(data);
    console.log("SIZE", size);

    console.log("Sending fetch post");
    const resp = await fetch("https://5c39-2001-569-5124-1100-19dc-6aa5-803b-233b.ngrok-free.app", {
      // const resp = await fetch("http://192.168.1.190:8082/xcpd", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Content-Length": size.toString(),
        Accept: "*/*",
        "Accept-Encoding": "gzip, deflate, br",
        Connection: "keep-alive",
      },
      body: data,
    });
    // const respText = await resp.text();
    // const respText = await resp.json();
    console.log(`RESPONSE:`, resp);
    console.log(`RESPONSE HEAD:`, resp.headers);
    console.log(`RESPONSE STATUS TEXT:`, resp.statusText);
    console.log(`RESPONSE URLS:`, resp.url);
    // console.log(`RESPONSE TEXT:`, respText);
  }

  /**
   * Query Documents (XCA-ITI-38) request.
   * https://profiles.ihe.net/ITI/TF/Volume2/ITI-38.html
   *
   * @param documentQueryRequest An array of document query transaction requests.
   *
   */
  async startDocumentsQuery(documentQueryRequest: DocumentQueryRequest): Promise<void> {
    await this.api.post(IHEGateway.DOCUMENT_QUERY_ENDPOINT, documentQueryRequest);
  }

  /**
   * Retrieve Documents (XCA-ITI-39) request.
   * https://profiles.ihe.net/ITI/TF/Volume2/ITI-39.html
   *
   * @param documentRetrieval An array of document retrieval transaction requests.
   *
   */
  async startDocumentsRetrieval(documentRetrieval: DocumentRetrievalRequest): Promise<void> {
    await this.api.post(IHEGateway.DOCUMENT_RETRIEVAL_ENDPOINT, documentRetrieval);
  }
}

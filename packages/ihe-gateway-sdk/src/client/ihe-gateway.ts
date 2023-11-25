import axios, { AxiosInstance } from "axios";
import { v4 as uuidv4 } from "uuid";
import { npiStringArraySchema } from "../models/shared";
import {
  XCPDPayload,
  XCPDRequest,
  xcpdGatewaysSchema,
  XCPDResponse,
  xcpdResponseSchema,
} from "../models/xcpd";
import { XCADQRequest } from "../models/xcadq";

const DEFAULT_AXIOS_TIMEOUT_SECONDS = 120;

export enum APIMode {
  dev = "dev",
  integration = "integration",
  production = "production",
}

export class IHEGateway {
  static productionUrl = "https://ihe.metriport.com";
  static integrationUrl = "https://ihe.staging.metriport.com";
  static devUrl = "https://localhost:8082";

  static XCPD_ENDPOINT = "/xcpd";
  static XCADQ_ENDPOINT = "/xcadq";
  static XCADR_ENDPOINT = "/xcadr";

  readonly api: AxiosInstance;
  constructor(apiMode: APIMode, options: { timeout?: number } = {}) {
    this.api = axios.create({
      timeout: options?.timeout ?? DEFAULT_AXIOS_TIMEOUT_SECONDS * 1_000,
      baseURL:
        apiMode === APIMode.production
          ? IHEGateway.productionUrl
          : apiMode === APIMode.integration
          ? IHEGateway.integrationUrl
          : IHEGateway.devUrl,
    });
  }

  /**
   * Patient Discovery (XCPD) request.
   * @param patient The patient data in FHIR R4 format.
   * @param cxId The customer ID.
   * @param xcpdGateways The OIDs and XCPD ITI-55 URLs of each organization to make a request to.
   * @param principalCareProviderNPIs The list of NPIs of the practitioners associated with the patient.
   * @param requestId Optional. Unique ID for the request. If not provided, one will be created.
   *
   * @returns an XCPD request to be used with an IHE Gateway.
   *
   * @throws {@link ZodError}
   * Thrown if organization OIDs or principalCareProviderNPIs don't meet their respective criteria.
   */
  async getPatient({
    patient,
    cxId,
    xcpdGateways,
    principalCareProviderNPIs,
    requestId,
  }: XCPDPayload): Promise<XCPDResponse> {
    const xcpdRequest = this.createXCPDRequest({
      patient,
      cxId,
      xcpdGateways,
      principalCareProviderNPIs,
      requestId,
    });

    const resp = await this.api.post(IHEGateway.XCPD_ENDPOINT, xcpdRequest);

    return xcpdResponseSchema.parse(resp);
  }

  /**
   * Get Documents (XCPDQ-ITI-38) request.
   * https://profiles.ihe.net/ITI/TF/Volume2/ITI-38.html
   *
   * @param xcadq The XCADQ request.
   *
   * @returns an XCPD request to be used with an IHE Gateway.
   *
   * @throws {@link ZodError}
   * Thrown if organization OIDs or principalCareProviderNPIs don't meet their respective criteria.
   */
  async getDocuments(xcadq: XCADQRequest): Promise<XCPDResponse> {
    const resp = await this.api.post(IHEGateway.XCADQ_ENDPOINT, xcadq);

    return xcpdResponseSchema.parse(resp);
  }

  async retrieveDocument(payload: XCADRRequest): Promise<XCPDResponse> {
    const resp = await this.api.post(IHEGateway.XCADR_ENDPOINT, payload);

    return xcpdResponseSchema.parse(resp);
  }

  //--------------------------------------------------------------------------------------------
  // Private Methods
  //--------------------------------------------------------------------------------------------
  private createXCPDRequest({
    patient,
    cxId,
    xcpdGateways,
    principalCareProviderNPIs,
    requestId,
  }: XCPDPayload): XCPDRequest {
    const xcpdRequest: XCPDRequest = {
      id: requestId ?? uuidv4(), // #1263 TODO: need to change this to UUIDv7
      cxId,
      xcpdGateways: xcpdGatewaysSchema.parse(xcpdGateways),
      timestamp: new Date().toISOString(),
      patientResource: patient,
    };

    if (principalCareProviderNPIs) {
      xcpdRequest.principalCareProviderNPIs = npiStringArraySchema.parse(principalCareProviderNPIs);
    }

    return xcpdRequest;
  }
}

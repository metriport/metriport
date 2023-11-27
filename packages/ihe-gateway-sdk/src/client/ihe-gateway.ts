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
import { XCA_ITI_38Request } from "../models/xca_iti_38";
import { XCA_ITI_39Request } from "../models/xca_iti_39";

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
  static XCA_ITI_38_ENDPOINT = "/xcadq";
  static XCA_ITI_39_ENDPOINT = "/xcadr";

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
   * Patient Discovery (XCPD ITI-55) request.
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
   * Query Documents (XCA-ITI-38) request.
   * https://profiles.ihe.net/ITI/TF/Volume2/ITI-38.html
   *
   * @param xcaIti38Request An array of document query transaction requests.
   * @param xcaIti38Request[].id Unique ID for the request.
   * @param xcaIti38Request[].cxId The customer ID.
   * @param xcaIti38Request[].homeCommunityId The OID of the organization to make a request to.
   * @param xcaIti38Request[].urlDQ The XCA ITI-38 endpoint of the organization to make a request to.
   * @param xcaIti38Request[].patientIdentifier The patient identifier.
   * @param xcaIti38Request[].classCode Optional. The class code of the document.
   * @param xcaIti38Request[].practiceSettingCode Optional. The practice setting code of the document.
   * @param xcaIti38Request[].facilityTypeCode Optional. The facility type code of the document.
   * @param xcaIti38Request[].documentCreationDate Optional. The document creation date.
   * @param xcaIti38Request[].serviceDate Optional. The service date.
   *
   *
   * @returns an XCPD request to be used with an IHE Gateway.
   */
  async getDocuments(xcaIti38Request: XCA_ITI_38Request): Promise<XCPDResponse> {
    const resp = await this.api.post(IHEGateway.XCA_ITI_38_ENDPOINT, xcaIti38Request);

    return xcpdResponseSchema.parse(resp);
  }

  /**
   * Retrieve Documents (XCA-ITI-39) request.
   * https://profiles.ihe.net/ITI/TF/Volume2/ITI-39.html
   *
   * @param xcaIti39Request An array of document retrieval transaction requests.
   * @param xcaIti39Request[].id Unique ID for the request.
   * @param xcaIti39Request[].cxId The customer ID.
   * @param xcaIti39Request[].homeCommunityId The OID of the organization to make a request to.
   * @param xcaIti39Request[].repositoryUniqueId The unique ID of the repository.
   * @param xcaIti39Request[].documentUniqueId The unique ID of the document.
   *
   * @returns an XCPD request to be used with an IHE Gateway.
   */
  async retrieveDocument(xcaIti39Request: XCA_ITI_39Request): Promise<XCPDResponse> {
    const resp = await this.api.post(IHEGateway.XCA_ITI_39_ENDPOINT, xcaIti39Request);

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

// XCPD BULK 8081
// XCPD 8082
// XCA 38 BULK 8083
// XCA 38 8084
// XCA 39 BULK 8085
// XCA 39 8086

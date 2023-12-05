import axios, { AxiosInstance } from "axios";
import { v4 as uuidv4 } from "uuid";
import { npiStringArraySchema } from "../models/shared";
import { XCPDPayload, XCPDRequest, xcpdGatewaysSchema, XCPDResponse } from "../models/xcpd";
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
   * https://profiles.ihe.net/ITI/TF/Volume2/ITI-55.html
   *
   * @param xcpdIti55Request An array of patient discovery transaction requests.
   * @param xcpdIti55Request[].id Unique ID for the request.
   * @param xcpdIti55Request[].cxId The customer ID.
   * @param xcpdIti55Request[].timestamp The timestamp of the request.
   * @param xcpdIti55Request[].xcpdGateways The OIDs and XCPD ITI-55 URLs of each organization to make a request to.
   * @param xcpdIti55Request[].principalCareProviderNPIs The list of NPIs of the practitioners associated with the patient.
   * @param xcpdIti55Request[].samlAttributes The SAML attributes of the org making the request.
   * @param xcpdIti55Request[].patient The patient data in FHIR R4 format.
   *
   * @returns 202 Accepted if the request was successful.
   */
  async getPatient(xcpdIti55Request: XCPDRequest[]): Promise<void> {
    return await this.api.post(IHEGateway.XCPD_ENDPOINT, xcpdIti55Request);
  }

  /**
   * Query Documents (XCA-ITI-38) request.
   * https://profiles.ihe.net/ITI/TF/Volume2/ITI-38.html
   *
   * @param xcaIti38Request An array of document query transaction requests.
   * @param xcaIti38Request[].id Unique ID for the request.
   * @param xcaIti38Request[].cxId The customer ID.
   * @param xcaIti38Request[].timestamp The timestamp of the request.
   * @param xcaIti38Request[].homeCommunityId The OID of the organization to make a request to.
   * @param xcaIti38Request[].xcpdPatientId The patient identifier.
   * @param xcaIti38Request[].xcpdGateway The XCA ITI-38 endpoint of the organization to make a request to.
   * @param xcaIti38Request[].samlAttributes The SAML attributes of the org making the request.
   * @param xcaIti38Request[].classCode Optional. The class code of the document.
   * @param xcaIti38Request[].practiceSettingCode Optional. The practice setting code of the document.
   * @param xcaIti38Request[].facilityTypeCode Optional. The facility type code of the document.
   * @param xcaIti38Request[].documentCreationDate Optional. The document creation date.
   * @param xcaIti38Request[].serviceDate Optional. The service date.
   *
   * @returns 202 Accepted if the request was successful.
   */
  async getDocuments(xcaIti38Request: XCA_ITI_38Request): Promise<void> {
    return await this.api.post(IHEGateway.XCA_ITI_38_ENDPOINT, xcaIti38Request);
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
   * @returns 202 Accepted if the request was successful.
   */
  async retrieveDocument(xcaIti39Request: XCA_ITI_39Request): Promise<XCPDResponse> {
    return await this.api.post(IHEGateway.XCA_ITI_39_ENDPOINT, xcaIti39Request);
  }

  createXCPDRequest({
    patient,
    cxId,
    xcpdGateways,
    principalCareProviderNPIs,
    requestId,
    org,
  }: XCPDPayload): XCPDRequest {
    const user = `${org.name} System User`;
    const defaultSubjectRole = {
      display: "Administrative AND/OR managerial worker",
      code: "106331006",
    };

    const xcpdRequest: XCPDRequest = {
      id: requestId ?? uuidv4(),
      cxId,
      timestamp: new Date().toISOString(),
      xcpdGateways: xcpdGatewaysSchema.parse(xcpdGateways),
      patientResource: patient,
      samlAttributes: {
        subjectId: user,
        subjectRole: defaultSubjectRole,
        organization: org.name,
        organizationId: org.oid,
        homeCommunityId: org.oid,
        purposeOfUse: "TREATMENT",
      },
    };

    if (principalCareProviderNPIs) {
      xcpdRequest.principalCareProviderNPIs = npiStringArraySchema.parse(principalCareProviderNPIs);
    }

    return xcpdRequest;
  }
}

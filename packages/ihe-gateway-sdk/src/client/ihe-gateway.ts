import { Patient } from "@medplum/fhirtypes";
import { v4 as uuidv4 } from "uuid";
import { principalCareProviderIdsSchema } from "../models/shared";
import { XCPDGateways, XCPDRequest, xcpdGatewaysSchema } from "../models/xcpd-request";

export class IHEGateway {
  /**
   * An XCPD request interface
   * @param patient The patient data in FHIR R4 format.
   * @param cxId The customer ID.
   * @param xcpdGateways The OIDs and XCPD ITI-55 urls of each organization to make a request to.
   * @param principalCareProviderIds The list of NPIs of the practitioners associated with the patient.
   * @returns an XCPD request to be used with an IHE Gateway.
   */
  createXCPDRequest({
    patient,
    cxId,
    xcpdGateways,
    principalCareProviderIds,
  }: {
    patient: Patient;
    cxId: string;
    xcpdGateways: XCPDGateways;
    principalCareProviderIds?: string[];
  }): XCPDRequest {
    const xcpdRequest: XCPDRequest = {
      id: uuidv4(),
      cxId,
      xcpdGateways: xcpdGatewaysSchema.parse(xcpdGateways),
      timestamp: new Date().toISOString(),
      patientResource: patient,
    };

    if (principalCareProviderIds) {
      xcpdRequest.principalCareProviderIds =
        principalCareProviderIdsSchema.parse(principalCareProviderIds);
    }

    return xcpdRequest;
  }
}

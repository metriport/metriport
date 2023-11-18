import { Patient } from "@medplum/fhirtypes";
import { v4 as uuidv4 } from "uuid";
import { NPIStringArray, npiStringArraySchema } from "../models/shared";
import { XCPDGateways, XCPDRequest, xcpdGatewaysSchema } from "../models/xcpd-request";

export class IHEGateway {
  /**
   * An XCPD request interface
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
  createXCPDRequest({
    patient,
    cxId,
    xcpdGateways,
    principalCareProviderNPIs,
    requestId,
  }: {
    patient: Patient;
    cxId: string;
    xcpdGateways: XCPDGateways;
    principalCareProviderNPIs?: NPIStringArray;
    requestId?: string;
  }): XCPDRequest {
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

import { Patient } from "@medplum/fhirtypes";
import { uuidv7 } from "@metriport/core/util/uuid-v7";
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
   * @throws ZodError if organization OIDs or principalCareProviderNPIs don't meet their respective criteria.
   *
   * @returns an XCPD request to be used with an IHE Gateway.
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
      id: requestId ?? uuidv7(),
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

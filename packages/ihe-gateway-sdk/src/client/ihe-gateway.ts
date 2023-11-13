import { Patient } from "@medplum/fhirtypes";
import { v4 as uuidv4 } from "uuid";
import {
  XCPDGateway,
  XCPDRequest,
  principalCareProviderIdsSchema,
  xcpdGatewaySchema,
} from "../models/xcpd-request";

export class IHEGateway {
  createXCPDRequest({
    patient,
    cxId,
    xcpdGateways,
    principalCareProviderIds,
  }: {
    patient: Patient;
    cxId: string;
    xcpdGateways: XCPDGateway[];
    principalCareProviderIds?: string[];
  }): XCPDRequest {
    const xcpdRequest: XCPDRequest = {
      id: uuidv4(),
      cxId,
      xcpdGateways: xcpdGatewaySchema.parse(xcpdGateways),
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

import fs from "fs";
import path from "path";
import { processXCPDResponse } from "../process-xcpd-response";
import {
  outboundPatientDiscoveryRespSuccessfulSchema,
  outboundPatientDiscoveryRespFaultSchema,
} from "@metriport/ihe-gateway-sdk";

import { outboundRequest, expectedResponse } from "./constants";

if (!outboundRequest.gateways[0]) {
  throw new Error("Gateway must be provided");
}
const gateway = {
  url: outboundRequest.gateways[0].url,
  oid: outboundRequest.gateways[0].oid,
  id: outboundRequest.gateways[0].id,
};

describe("processXCPDResponse", () => {
  it("should process the match XCPD response correctly", async () => {
    const xmlString = fs.readFileSync(path.join(__dirname, "xcpd_match.xml"), "utf8");

    const response = processXCPDResponse({
      xmlStringOrError: xmlString,
      outboundRequest,
      gateway,
    });

    const xcpdResult = outboundPatientDiscoveryRespSuccessfulSchema.safeParse(response);
    if (!xcpdResult.success) {
      throw new Error("Failed to parse response");
    }
    if (xcpdResult.success) {
      expect(xcpdResult.data.externalGatewayPatient?.id).toEqual(
        expectedResponse?.externalGatewayPatient?.id
      );
      expect(xcpdResult.data.externalGatewayPatient?.system).toEqual(
        expectedResponse?.externalGatewayPatient?.system
      );
      expect(xcpdResult.data.patientMatch).toBe(expectedResponse?.patientMatch);
      expect(xcpdResult.data.patientResource).toEqual(expectedResponse?.patientResource);
    }
  });
  it("should correctly identify and process a no match XCPD response", async () => {
    const xmlString = fs.readFileSync(path.join(__dirname, "xcpd_no_match.xml"), "utf8");
    const response = processXCPDResponse({
      xmlStringOrError: xmlString,
      outboundRequest,
      gateway,
    });
    const xcpdResult = outboundPatientDiscoveryRespFaultSchema.safeParse(response);
    if (!xcpdResult.success) {
      throw new Error("Failed to parse response");
    }
    expect(xcpdResult.data.patientMatch).toBeFalsy();
  });
  it("should process the error XCPD response correctly", async () => {
    const xmlString = fs.readFileSync(path.join(__dirname, "xcpd_error.xml"), "utf8");

    const response = processXCPDResponse({
      xmlStringOrError: xmlString,
      outboundRequest,
      gateway,
    });
    const xcpdResult = outboundPatientDiscoveryRespFaultSchema.safeParse(response);
    if (!xcpdResult.success) {
      throw new Error("Failed to parse response");
    }
    expect(xcpdResult.data.patientMatch).toBeNull();
  });
  it("should process the HTTP error XCPD response correctly", async () => {
    const httpError = { error: "HTTP 503 error" };

    const response = processXCPDResponse({
      xmlStringOrError: httpError,
      outboundRequest,
      gateway,
    });
    const xcpdResult = outboundPatientDiscoveryRespFaultSchema.safeParse(response);
    if (!xcpdResult.success) {
      throw new Error("Failed to parse response");
    }
    console.log(JSON.stringify(xcpdResult.data, null, 2));
    expect(xcpdResult.data.operationOutcome).toBeDefined();
    expect(xcpdResult.data.patientMatch).toBeNull();
  });
});

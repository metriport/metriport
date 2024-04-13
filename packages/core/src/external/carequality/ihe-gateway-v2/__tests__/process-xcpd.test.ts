import fs from "fs";
import path from "path";
import { processXCPDResponse } from "../xcpd/process-xcpd-response";
import {
  outboundPatientDiscoveryRespSuccessfulSchema,
  outboundPatientDiscoveryRespFaultSchema,
} from "@metriport/ihe-gateway-sdk";

import { outboundXCPDRequest, expectedXCPDResponse } from "./constants";

if (!outboundXCPDRequest.gateways[0]) {
  throw new Error("Gateway must be provided");
}
const gateway = {
  url: outboundXCPDRequest.gateways[0].url,
  oid: outboundXCPDRequest.gateways[0].oid,
  id: outboundXCPDRequest.gateways[0].id,
};

describe("processXCPDResponse", () => {
  it("should process the match XCPD response correctly", async () => {
    const xmlString = fs.readFileSync(path.join(__dirname, "xmls/xcpd_match.xml"), "utf8");

    const response = processXCPDResponse({
      xmlStringOrError: xmlString,
      outboundRequest: outboundXCPDRequest,
      gateway,
    });

    const xcpdResult = outboundPatientDiscoveryRespSuccessfulSchema.safeParse(response);
    if (!xcpdResult.success) {
      throw new Error("Failed to parse response");
    }
    if (xcpdResult.success) {
      expect(xcpdResult.data.externalGatewayPatient?.id).toEqual(
        expectedXCPDResponse?.externalGatewayPatient?.id
      );
      expect(xcpdResult.data.externalGatewayPatient?.system).toEqual(
        expectedXCPDResponse?.externalGatewayPatient?.system
      );
      expect(xcpdResult.data.patientMatch).toBe(expectedXCPDResponse?.patientMatch);
      expect(xcpdResult.data.patientResource).toEqual(expectedXCPDResponse?.patientResource);
    }
  });
  it("should correctly identify and process a no match XCPD response", async () => {
    const xmlString = fs.readFileSync(path.join(__dirname, "xmls/xcpd_no_match.xml"), "utf8");
    const response = processXCPDResponse({
      xmlStringOrError: xmlString,
      outboundRequest: outboundXCPDRequest,
      gateway,
    });
    const xcpdResult = outboundPatientDiscoveryRespFaultSchema.safeParse(response);
    if (!xcpdResult.success) {
      throw new Error("Failed to parse response");
    }
    expect(xcpdResult.data.patientMatch).toBeFalsy();
  });
  it("should process the error XCPD response correctly", async () => {
    const xmlString = fs.readFileSync(path.join(__dirname, "xmls/xcpd_error.xml"), "utf8");

    const response = processXCPDResponse({
      xmlStringOrError: xmlString,
      outboundRequest: outboundXCPDRequest,
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
      outboundRequest: outboundXCPDRequest,
      gateway,
    });
    const xcpdResult = outboundPatientDiscoveryRespFaultSchema.safeParse(response);
    if (!xcpdResult.success) {
      throw new Error("Failed to parse response");
    }
    expect(xcpdResult.data.operationOutcome).toBeDefined();
    expect(xcpdResult.data.patientMatch).toBeNull();
  });
});

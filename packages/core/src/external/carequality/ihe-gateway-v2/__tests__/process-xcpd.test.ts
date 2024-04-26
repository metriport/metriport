import fs from "fs";
import path from "path";
import { processXCPDResponse } from "../xcpd/process-xcpd-response";
import { outboundXCPDRequest, expectedXCPDResponse } from "./constants";

const gateway = outboundXCPDRequest.gateways[0];
if (!gateway) {
  throw new Error("Gateway must be provided");
}

const xmlMatchString = fs.readFileSync(path.join(__dirname, "xmls/xcpd_match.xml"), "utf8");
const xmlNoMatchString = fs.readFileSync(path.join(__dirname, "xmls/xcpd_no_match.xml"), "utf8");
const xmlErrorString = fs.readFileSync(path.join(__dirname, "xmls/xcpd_error.xml"), "utf8");

describe("processXCPDResponse", () => {
  it("should process the match XCPD response correctly", async () => {
    const response = processXCPDResponse({
      xcpdResponse: {
        success: true,
        response: xmlMatchString,
        gateway,
        outboundRequest: outboundXCPDRequest,
      },
    });

    expect(response).toEqual({
      ...expectedXCPDResponse,
      responseTimestamp: expect.any(String),
    });
  });
  it("should correctly identify and process a no match XCPD response", async () => {
    const response = processXCPDResponse({
      xcpdResponse: {
        success: true,
        response: xmlNoMatchString,
        gateway,
        outboundRequest: outboundXCPDRequest,
      },
    });

    expect(response.patientMatch).toBeFalsy();
  });
  it("should process the error XCPD response correctly", async () => {
    const response = processXCPDResponse({
      xcpdResponse: {
        success: false,
        response: xmlErrorString,
        gateway,
        outboundRequest: outboundXCPDRequest,
      },
    });

    expect(response.patientMatch).toBeNull();
  });
  it("should process the HTTP error XCPD response correctly", async () => {
    const httpError = { error: "HTTP 503 error" };

    const response = processXCPDResponse({
      xcpdResponse: {
        success: false,
        response: httpError.error,
        gateway,
        outboundRequest: outboundXCPDRequest,
      },
    });

    expect(response.operationOutcome).toBeDefined();
    expect(response.patientMatch).toBeNull();
  });
});

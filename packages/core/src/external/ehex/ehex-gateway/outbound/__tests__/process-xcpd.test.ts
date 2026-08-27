import fs from "fs";
import path from "path";
import { processXCPDResponse } from "../xcpd/process/xcpd-response";
import { ehexOutboundPatientDiscoveryRespSchema } from "../xcpd/process/types";
import {
  expectedMultiNameAddressResponse,
  expectedXcpdResponse,
  outboundXcpdRequest,
} from "./constants";

const gateway = outboundXcpdRequest.gateways[0];
if (!gateway) {
  throw new Error("Gateway must be provided");
}

const xmlMatchString = fs.readFileSync(path.join(__dirname, "xmls/xcpd_match.xml"), "utf8");
const xmlMatchStringMultiNameAddress = fs.readFileSync(
  path.join(__dirname, "xmls/xcpd_match_multi_addr_name.xml"),
  "utf8"
);
const xmlMatchNoAddresses = fs.readFileSync(
  path.join(__dirname, "xmls/xcpd_match_no_addresses.xml"),
  "utf8"
);
const xmlNoMatchString = fs.readFileSync(path.join(__dirname, "xmls/xcpd_no_match.xml"), "utf8");
const xmlErrorString = fs.readFileSync(path.join(__dirname, "xmls/xcpd_error.xml"), "utf8");

describe("processXCPDResponse", () => {
  it("should process the match XCPD response correctly", async () => {
    const response = processXCPDResponse({
      xcpdResponse: {
        success: true,
        response: xmlMatchString,
        gateway,
        outboundRequest: outboundXcpdRequest,
      },
      cxId: outboundXcpdRequest.cxId,
      responseHttpStatusCode: 200,
    });

    expect(response).toEqual({
      ...expectedXcpdResponse,
      cxId: outboundXcpdRequest.cxId,
      duration: expect.any(Number),
      responseHttpStatusCode: 200,
      responseTimestamp: expect.any(String),
      requestTimestamp: expect.any(String),
    });
  });

  it("should process the match XCPD response with multiple addresses and patient names correctly", async () => {
    const response = processXCPDResponse({
      xcpdResponse: {
        success: true,
        response: xmlMatchStringMultiNameAddress,
        gateway,
        outboundRequest: outboundXcpdRequest,
      },
      cxId: outboundXcpdRequest.cxId,
      responseHttpStatusCode: 200,
    });

    expect(response).toEqual({
      ...expectedMultiNameAddressResponse,
      cxId: outboundXcpdRequest.cxId,
      duration: expect.any(Number),
      responseHttpStatusCode: 200,
      responseTimestamp: expect.any(String),
      requestTimestamp: expect.any(String),
    });
  });

  it("should process the match XCPD response with no addresses correctly", async () => {
    const response = processXCPDResponse({
      xcpdResponse: {
        success: true,
        response: xmlMatchNoAddresses,
        gateway,
        outboundRequest: outboundXcpdRequest,
      },
      cxId: outboundXcpdRequest.cxId,
      responseHttpStatusCode: 200,
    });

    const parsedResponse = ehexOutboundPatientDiscoveryRespSchema.safeParse(response);
    expect(parsedResponse.success).toBeTruthy();
  });

  it("should correctly identify and process a no match XCPD response", async () => {
    const response = processXCPDResponse({
      xcpdResponse: {
        success: true,
        response: xmlNoMatchString,
        gateway,
        outboundRequest: outboundXcpdRequest,
      },
      cxId: outboundXcpdRequest.cxId,
      responseHttpStatusCode: 200,
    });

    expect(response.patientMatch).toBeFalsy();
  });
  it("should process the error XCPD response correctly", async () => {
    const response = processXCPDResponse({
      xcpdResponse: {
        success: false,
        response: xmlErrorString,
        gateway,
        outboundRequest: outboundXcpdRequest,
      },
      cxId: outboundXcpdRequest.cxId,
      responseHttpStatusCode: 400,
    });

    expect(response.patientMatch).not.toBeTruthy();
  });
  it("should process the HTTP error XCPD response correctly", async () => {
    const httpError = { error: "HTTP 503 error" };

    const response = processXCPDResponse({
      xcpdResponse: {
        success: false,
        response: httpError.error,
        gateway,
        outboundRequest: outboundXcpdRequest,
      },
      cxId: outboundXcpdRequest.cxId,
      responseHttpStatusCode: 503,
    });

    expect(response.operationOutcome).toBeTruthy();
    expect(response.patientMatch).not.toBeTruthy();
  });
  it("should process response that is not a string correctly", async () => {
    const randomResponse = "This is a bad response and is not xml";

    const response = processXCPDResponse({
      xcpdResponse: {
        success: true,
        response: randomResponse,
        gateway,
        outboundRequest: outboundXcpdRequest,
      },
      cxId: outboundXcpdRequest.cxId,
      responseHttpStatusCode: 400,
    });
    expect(response.operationOutcome).toBeTruthy();
    expect(response.patientMatch).not.toBeTruthy();
  });
});

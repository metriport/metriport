import fs from "fs";
import path from "path";
import {
  processXCPDResponse,
  convertIheAddressToAddress,
  isValidAddress,
} from "../xcpd/process/xcpd-response";
import {
  outboundXcpdRequest,
  expectedXcpdResponse,
  expectedMultiNameAddressResponse,
} from "./constants";
import { outboundPatientDiscoveryRespSchema } from "@metriport/ihe-gateway-sdk";

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
    });

    expect(response).toEqual({
      ...expectedXcpdResponse,
      responseTimestamp: expect.any(String),
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
    });

    expect(response).toEqual({
      ...expectedMultiNameAddressResponse,
      responseTimestamp: expect.any(String),
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
    });

    const parsedResponse = outboundPatientDiscoveryRespSchema.safeParse(response);
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
        outboundRequest: outboundXcpdRequest,
      },
    });

    expect(response.operationOutcome).toBeTruthy();
    expect(response.patientMatch).toBeNull();
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
    });
    expect(response.operationOutcome).toBeTruthy();
    expect(response.patientMatch).toBeNull();
  });
});

describe("convertIheAddressToAddress", () => {
  it("should correct invalid streetAddressLine", () => {
    const iheAddresses = {
      streetAddressLine: [2831],
      city: "San Francisco",
      state: "CA",
      postalCode: "94101",
      country: "USA",
    };
    const result = convertIheAddressToAddress(iheAddresses);
    expect(result).toEqual({
      line: ["2831"],
      city: "San Francisco",
      country: "USA",
      postalCode: "94101",
      state: "CA",
    });
    if (result) {
      const isValid = isValidAddress(result);
      expect(isValid).toBeTruthy();
    } else {
      throw new Error("Result is null");
    }
  });
  it("should filter out empty address", () => {
    const iheAddresses = {
      streetAddressLine: [],
      city: "San Francisco",
      state: "CA",
      postalCode: "94101",
      country: "USA",
    };
    const result = convertIheAddressToAddress(iheAddresses);
    expect(result).toEqual({
      city: "San Francisco",
      state: "CA",
      postalCode: "94101",
      country: "USA",
    });
    if (result) {
      const isValid = isValidAddress(result);
      expect(isValid).toBeTruthy();
    } else {
      throw new Error("Result is null");
    }
  });
  it("should filter out 0 as city value", () => {
    const iheAddresses = {
      streetAddressLine: "111 Market St",
      city: 0,
      state: "CA",
      postalCode: "94101",
      country: "USA",
    };
    const result = convertIheAddressToAddress(iheAddresses);
    expect(result).toEqual({
      line: ["111 Market St"],
      state: "CA",
      postalCode: "94101",
      country: "USA",
    });

    if (result) {
      const isValid = isValidAddress(result);
      expect(isValid).toBeTruthy();
    } else {
      throw new Error("Result is null");
    }
  });
  it("should stringify 1 as city value", () => {
    const iheAddresses = {
      streetAddressLine: "111 Market St",
      city: 1,
      state: "CA",
      postalCode: "94101",
      country: "USA",
    };
    const result = convertIheAddressToAddress(iheAddresses);
    expect(result).toEqual({
      line: ["111 Market St"],
      city: "1",
      state: "CA",
      postalCode: "94101",
      country: "USA",
    });
    if (result) {
      const isValid = isValidAddress(result);
      expect(isValid).toBeTruthy();
    } else {
      throw new Error("Result is null");
    }
  });
});

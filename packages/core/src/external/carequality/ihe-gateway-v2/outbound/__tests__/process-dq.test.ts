import fs from "fs";
import path from "path";
import { processDQResponse, parseCreationTime } from "../xca/process/dq-response";
import { outboundDqRequest, expectedDqDocumentReference } from "./constants";

describe("processDQResponse", () => {
  it("should process the successful DQ response correctly", async () => {
    const xmlString = fs.readFileSync(path.join(__dirname, "xmls/dq_multiple_docs.xml"), "utf8");
    const response = processDQResponse({
      dqResponse: {
        response: xmlString,
        success: true,
        gateway: outboundDqRequest.gateway,
        outboundRequest: outboundDqRequest,
      },
    });
    if (!response.documentReference) {
      throw new Error("No DocumentReferences found");
    }
    expect(response.documentReference).toEqual(expectedDqDocumentReference);
  });
  it("should process the empty DQ response correctly", async () => {
    const xmlString = fs.readFileSync(path.join(__dirname, "xmls/dq_empty.xml"), "utf8");
    const response = processDQResponse({
      dqResponse: {
        response: xmlString,
        success: true,
        gateway: outboundDqRequest.gateway,
        outboundRequest: outboundDqRequest,
      },
    });
    expect(response.operationOutcome?.issue[0]?.code).toEqual("no-documents-found");
  });

  it("should process the DQ response with registry error correctly", async () => {
    const xmlString = fs.readFileSync(path.join(__dirname, "xmls/dq_error.xml"), "utf8");
    const response = processDQResponse({
      dqResponse: {
        response: xmlString,
        success: true,
        gateway: outboundDqRequest.gateway,
        outboundRequest: outboundDqRequest,
      },
    });
    expect(response.operationOutcome?.issue[0]?.code).toEqual("XDSRegistryError");
  });

  it("should process response that is not a string correctly", async () => {
    const randomResponse = "This is a bad response and is not xml";

    const response = processDQResponse({
      dqResponse: {
        success: true,
        response: randomResponse,
        gateway: outboundDqRequest.gateway,
        outboundRequest: outboundDqRequest,
      },
    });
    expect(response.operationOutcome).toBeTruthy();
    expect(response.operationOutcome?.issue[0]?.severity).toEqual("information");
  });
});

describe("parseCreationTime", () => {
  it("should return the iso date correctly", () => {
    const input = "2023-10-01T12:34:56";
    const result = parseCreationTime(input);
    expect(result).toBe(input);
  });

  it("should format the string correctly", () => {
    const input = "20231001123456";
    const expectedOutput = "2023-10-01T12:34:56";
    const result = parseCreationTime(input);
    expect(result).toBe(expectedOutput);
  });

  it("should format the date correctly for no dashes in date", () => {
    const input = "20231001";
    const expectedOutput = "2023-10-01T00:00:00";
    const result = parseCreationTime(input);
    expect(result).toBe(expectedOutput);
  });

  it("should format the date correctly for dash date format", () => {
    const input = "2023-10-01";
    const expectedOutput = "2023-10-01T00:00:00";
    const result = parseCreationTime(input);
    expect(result).toBe(expectedOutput);
  });

  it("should return undefined for a random number", () => {
    const input = "123456";
    const result = parseCreationTime(input);
    expect(result).toBeUndefined();
  });

  it("should return undefined for an invalid date string", () => {
    const input = "invalid-date-string";
    const result = parseCreationTime(input);
    expect(result).toBeUndefined();
  });

  it("should return undefined for an empty string", () => {
    const input = "";
    const result = parseCreationTime(input);
    expect(result).toBeUndefined();
  });

  it("should return undefined for a date with a space in it", () => {
    const input = "2023-10-01 12:34:56";
    const result = parseCreationTime(input);
    expect(result).toBeUndefined();
  });

  it("should return undefined for a string with only time part", () => {
    const input = "12:34:56";
    const result = parseCreationTime(input);
    expect(result).toBeUndefined();
  });

  it("should return undefined for a string with invalid characters", () => {
    const input = "2023-10-01T12:34:56@";
    const result = parseCreationTime(input);
    expect(result).toBeUndefined();
  });
});

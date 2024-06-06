import fs from "fs";
import path from "path";
import { processDQResponse } from "../xca/process/dq-response";
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

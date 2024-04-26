import fs from "fs";
import path from "path";
import { processDQResponse } from "../xca/process-dq-response";
import { outboundDQRequest, expectedDQDocumentReference } from "./constants";

describe("processDQResponse", () => {
  it("should process the successful DQ response correctly", async () => {
    const xmlString = fs.readFileSync(path.join(__dirname, "xmls/dq_multiple_docs.xml"), "utf8");
    const response = processDQResponse({
      dqResponse: {
        response: xmlString,
        success: true,
        gateway: outboundDQRequest.gateway,
        outboundRequest: outboundDQRequest,
      },
    });
    if (!response.documentReference) {
      throw new Error("No DocumentReferences found");
    }
    expect(response.documentReference).toEqual(expectedDQDocumentReference);
  });
  it("should process the empty DQ response correctly", async () => {
    const xmlString = fs.readFileSync(path.join(__dirname, "xmls/dq_empty.xml"), "utf8");
    const response = processDQResponse({
      dqResponse: {
        response: xmlString,
        success: true,
        gateway: outboundDQRequest.gateway,
        outboundRequest: outboundDQRequest,
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
        gateway: outboundDQRequest.gateway,
        outboundRequest: outboundDQRequest,
      },
    });
    expect(response.operationOutcome?.issue[0]?.code).toEqual("XDSRegistryError");
  });
});

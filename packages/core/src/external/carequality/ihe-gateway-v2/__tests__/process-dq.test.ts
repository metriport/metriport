import fs from "fs";
import path from "path";
import { processDQResponse } from "../xca/process-dq-response";
import { outboundDQRequest } from "./constants";

describe("processDQResponse", () => {
  it("should process the successful DQ response correctly", async () => {
    const xmlString = fs.readFileSync(path.join(__dirname, "xmls/dq_multiple_docs.xml"), "utf8");
    const response = processDQResponse({
      xmlStringOrError: xmlString,
      outboundRequest: outboundDQRequest,
      gateway: outboundDQRequest.gateway,
    });
    if (!response.documentReference) {
      throw new Error("No DocumentReferences found");
    }
    expect(response.documentReference[0]?.docUniqueId).toEqual("123456789");
    expect(response.documentReference[1]?.docUniqueId).toEqual("987654321");
  });
  it("should process the empty DQ response correctly", async () => {
    const xmlString = fs.readFileSync(path.join(__dirname, "xmls/dq_empty.xml"), "utf8");
    const response = processDQResponse({
      xmlStringOrError: xmlString,
      outboundRequest: outboundDQRequest,
      gateway: outboundDQRequest.gateway,
    });
    expect(response.operationOutcome?.issue[0]?.code).toEqual("no-documents-found");
  });

  it("should process the DQ response with registry error correctly", async () => {
    const xmlString = fs.readFileSync(path.join(__dirname, "xmls/dq_error.xml"), "utf8");
    const response = processDQResponse({
      xmlStringOrError: xmlString,
      outboundRequest: outboundDQRequest,
      gateway: outboundDQRequest.gateway,
    });
    expect(response.operationOutcome?.issue[0]?.code).toEqual("XDSRegistryError");
  });
});

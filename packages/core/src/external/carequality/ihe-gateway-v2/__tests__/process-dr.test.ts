import fs from "fs";
import path from "path";
import { processDRResponse } from "../xca/process-dr-response";
import { outboundDRRequest } from "./constants";

describe("processDRResponse", () => {
  it("should process the successful DR response correctly", async () => {
    const xmlString = fs.readFileSync(path.join(__dirname, "xmls/dr_success.xml"), "utf8");
    const response = processDRResponse({
      xmlStringOrError: xmlString,
      outboundRequest: outboundDRRequest,
      gateway: outboundDRRequest.gateway,
    });
    const expectedDocumentReference = [
      {
        contentType: "application/pdf",
        docUniqueId: "123456789",
        homeCommunityId: "urn:oid:urn:oid:2.16.840.1.113883.3.9621",
        repositoryUniqueId: "urn:oid:2.16.840.1.113883.3.9621",
      },
      {
        contentType: "application/xml",
        docUniqueId: "987654321",
        homeCommunityId: "urn:oid:urn:oid:2.16.840.1.113883.3.9621",
        repositoryUniqueId: "urn:oid:2.16.840.1.113883.3.9621",
      },
    ];
    expect(response.documentReference).toEqual(expectedDocumentReference);
  });

  it("should process the soap fault DR response correctly", async () => {
    const xmlString = fs.readFileSync(path.join(__dirname, "xmls/dr_soap_error.xml"), "utf8");
    const response = processDRResponse({
      xmlStringOrError: xmlString,
      outboundRequest: outboundDRRequest,
      gateway: outboundDRRequest.gateway,
    });

    expect(response?.operationOutcome?.issue[0]?.code).toBe("soap:Sender");
  });

  it("should process the registry error DR response correctly", async () => {
    const xmlString = fs.readFileSync(path.join(__dirname, "xmls/dr_registry_error.xml"), "utf8");
    const response = processDRResponse({
      xmlStringOrError: xmlString,
      outboundRequest: outboundDRRequest,
      gateway: outboundDRRequest.gateway,
    });
    expect(response.operationOutcome?.issue[0]?.code).toEqual("XDSRegistryError");
  });

  it("should process the empty DR response correctly", async () => {
    const xmlString = fs.readFileSync(path.join(__dirname, "xmls/dr_empty.xml"), "utf8");
    const response = processDRResponse({
      xmlStringOrError: xmlString,
      outboundRequest: outboundDRRequest,
      gateway: outboundDRRequest.gateway,
    });
    expect(response.operationOutcome?.issue[0]?.code).toEqual("no-documents-found");
  });
});

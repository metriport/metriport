import fs from "fs";
import path from "path";
import { processDRResponse } from "../xca/process-dr-response";
import { outboundDRRequest, testFiles } from "./constants";

describe("processDRResponse", () => {
  it("should process the successful DR response correctly", async () => {
    const xmlString = fs.readFileSync(path.join(__dirname, "xmls/dr_success.xml"), "utf8");
    const response = await processDRResponse({
      xmlStringOrError: xmlString,
      outboundRequest: outboundDRRequest,
      gateway: outboundDRRequest.gateway,
    });
    const expectedDocumentReference = [
      {
        contentType: "application/octet-stream",
        docUniqueId: "123456789",
        homeCommunityId: "urn:oid:urn:oid:2.16.840.1.113883.3.9621",
        repositoryUniqueId: "urn:oid:2.16.840.1.113883.3.9621",
      },
      {
        contentType: "application/octet-stream",
        docUniqueId: "987654321",
        homeCommunityId: "urn:oid:urn:oid:2.16.840.1.113883.3.9621",
        repositoryUniqueId: "urn:oid:2.16.840.1.113883.3.9621",
      },
    ];
    expect(response.documentReference).toEqual(expectedDocumentReference);
  });

  it("should process the soap fault DR response correctly", async () => {
    const xmlString = fs.readFileSync(path.join(__dirname, "xmls/dr_soap_error.xml"), "utf8");
    const response = await processDRResponse({
      xmlStringOrError: xmlString,
      outboundRequest: outboundDRRequest,
      gateway: outboundDRRequest.gateway,
    });

    expect(response?.operationOutcome?.issue[0]?.code).toBe("soap:Sender");
  });

  it("should process the registry error DR response correctly", async () => {
    const xmlString = fs.readFileSync(path.join(__dirname, "xmls/dr_registry_error.xml"), "utf8");
    const response = await processDRResponse({
      xmlStringOrError: xmlString,
      outboundRequest: outboundDRRequest,
      gateway: outboundDRRequest.gateway,
    });
    expect(response.operationOutcome?.issue[0]?.code).toEqual("XDSRegistryError");
  });

  it("should process the empty DR response correctly", async () => {
    const xmlString = fs.readFileSync(path.join(__dirname, "xmls/dr_empty.xml"), "utf8");
    const response = await processDRResponse({
      xmlStringOrError: xmlString,
      outboundRequest: outboundDRRequest,
      gateway: outboundDRRequest.gateway,
    });
    expect(response.operationOutcome?.issue[0]?.code).toEqual("no-documents-found");
  });

  testFiles.forEach(({ name, mimeType, extension }) => {
    const xmlTemplatePath = path.join(__dirname, "./xmls/dr-no-mime-type.xml");
    const xmlTemplate = fs.readFileSync(xmlTemplatePath, "utf8");

    describe(`${name}`, () => {
      const fileContent = fs.readFileSync(path.join(__dirname, `./files/${name}`));
      const fileContentB64 = fileContent.toString("base64");
      const modifiedXml = xmlTemplate.replace(
        "<Document></Document>",
        `<Document>${fileContentB64}</Document>`
      );
      it(`should process the ${extension} DR response correctly`, async () => {
        const response = await processDRResponse({
          xmlStringOrError: modifiedXml,
          outboundRequest: outboundDRRequest,
          gateway: outboundDRRequest.gateway,
        });
        expect(response.documentReference?.[0]?.contentType).toEqual(mimeType);
      });
    });
  });
});

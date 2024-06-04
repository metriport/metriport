import fs from "fs";
import path from "path";
import { v4 as uuidv4 } from "uuid";
import { processDrResponse } from "../xca/process/dr-response";
import { outboundDrRequest, testFiles, outboundDrRequestMtom } from "./constants";
import { S3Utils } from "../../../../aws/s3";
import { createMtomMessageWithAttachments, createMtomMessageWithoutAttachments } from "./mtom";

describe("processDRResponse for MTOM with/without attachments and for different file types", () => {
  beforeEach(() => {
    jest.spyOn(S3Utils.prototype, "uploadFile").mockImplementation(() => {
      return Promise.resolve({
        Location: "http://example.com/mockurl",
        ETag: '"mockedetag"',
        Bucket: "mockedbucket",
        Key: "mockedkey",
      });
    });

    jest.spyOn(S3Utils.prototype, "getFileInfoFromS3").mockImplementation(() =>
      Promise.resolve({
        exists: false,
      })
    );
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  testFiles.forEach(({ name, mimeType, fileExtension }) => {
    it(`[mtom without attachments]: should process the ${fileExtension} DR response correctly`, async () => {
      const filePath = path.join(__dirname, "./files/", name);
      const fileBuffer = fs.readFileSync(filePath);

      const attachmentsData = [{ payload: fileBuffer, mimeType: mimeType }];
      const mtomAttachments = await createMtomMessageWithAttachments(attachmentsData);
      const response = await processDrResponse({
        drResponse: {
          mtomResponse: mtomAttachments,
          gateway: outboundDrRequestMtom.gateway,
          outboundRequest: outboundDrRequestMtom,
        },
      });

      expect(response).toBeDefined();
      expect(response.documentReference).toHaveLength(1);
      expect(response.documentReference?.[0]?.contentType).toBe(mimeType);
    });
  });

  testFiles.forEach(({ name, mimeType, fileExtension }) => {
    it(`[mtom with attachments]: should process the ${fileExtension} DR response correctly`, async () => {
      const xmlTemplatePath = path.join(__dirname, "./xmls/dr-no-mime-type.xml");
      const xmlTemplate = fs.readFileSync(xmlTemplatePath, "utf8");

      const fileContent = fs.readFileSync(path.join(__dirname, `./files/${name}`));
      const fileContentB64 = fileContent.toString("base64");
      const modifiedXml = xmlTemplate.replace(
        "<Document></Document>",
        `<Document>${fileContentB64}</Document>`
      );

      const mtomResponse = await createMtomMessageWithoutAttachments(modifiedXml);
      const response = await processDrResponse({
        drResponse: {
          mtomResponse: mtomResponse,
          gateway: outboundDrRequest.gateway,
          outboundRequest: {
            ...outboundDrRequest,
            documentReference: outboundDrRequest.documentReference.map(docRef => ({
              ...docRef,
              metriportId: uuidv4(),
            })),
          },
        },
      });
      expect(response?.documentReference?.[0]?.contentType).toEqual(mimeType);
    });
  });

  it("[mtom with multiple attachments]: should correctly create and parse MTOM message with XML, PDF, and TIFF attachments", async () => {
    const xmlFile = testFiles.find(file => file.fileExtension === ".xml");
    const pdfFile = testFiles.find(file => file.fileExtension === ".pdf");
    const tiffFile = testFiles.find(file => file.fileExtension === ".tiff");

    if (!xmlFile || !pdfFile || !tiffFile) {
      throw new Error("Required test files not found");
    }

    const xmlFilePath = path.join(__dirname, "./files/", xmlFile.name);
    const pdfFilePath = path.join(__dirname, "./files/", pdfFile.name);
    const tiffFilePath = path.join(__dirname, "./files/", tiffFile.name);

    const xmlBuffer = fs.readFileSync(xmlFilePath);
    const pdfBuffer = fs.readFileSync(pdfFilePath);
    const tiffBuffer = fs.readFileSync(tiffFilePath);

    const attachmentsData = [
      { payload: xmlBuffer, mimeType: xmlFile.mimeType },
      { payload: pdfBuffer, mimeType: pdfFile.mimeType },
      { payload: tiffBuffer, mimeType: tiffFile.mimeType },
    ];

    const mtomAttachments = await createMtomMessageWithAttachments(attachmentsData);
    const response = await processDrResponse({
      drResponse: {
        mtomResponse: mtomAttachments,
        gateway: outboundDrRequestMtom.gateway,
        outboundRequest: outboundDrRequestMtom,
      },
    });

    expect(response.documentReference).toBeTruthy();
    expect(response.documentReference).toHaveLength(3);
    const contentTypes = response.documentReference?.map(d => d.contentType);
    expect(contentTypes).toEqual(
      expect.arrayContaining([xmlFile.mimeType, pdfFile.mimeType, tiffFile.mimeType])
    );
    expect(response.documentReference?.[0]?.contentType).toBe(xmlFile.mimeType);
  });
});
describe("processDRResponse", () => {
  beforeEach(() => {
    jest.spyOn(S3Utils.prototype, "uploadFile").mockImplementation(() =>
      Promise.resolve({
        Location: "http://example.com/mockurl",
        ETag: '"mockedetag"',
        Bucket: "mockedbucket",
        Key: "mockedkey",
      })
    );
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it("should process multiple DR responses correctly", async () => {
    const xmlString = fs.readFileSync(path.join(__dirname, "xmls/dr_success.xml"), "utf8");
    const mtomResponse = await createMtomMessageWithoutAttachments(xmlString);
    const response = await processDrResponse({
      drResponse: {
        mtomResponse: mtomResponse,
        gateway: outboundDrRequest.gateway,
        outboundRequest: outboundDrRequest,
      },
    });
    expect(response.documentReference?.length).toBe(2);
    expect(response?.documentReference?.[0]?.contentType).toEqual("application/octet-stream");
    expect(response?.documentReference?.[0]?.docUniqueId).toEqual("123456789");
    expect(response?.documentReference?.[0]?.homeCommunityId).toEqual("2.16.840.1.113883.3.8391");
    expect(response?.documentReference?.[0]?.repositoryUniqueId).toEqual(
      "urn:oid:2.16.840.1.113883.3.9621"
    );

    expect(response?.documentReference?.[1]?.contentType).toEqual("application/octet-stream");
    expect(response?.documentReference?.[1]?.docUniqueId).toEqual("987654321");
    expect(response?.documentReference?.[1]?.homeCommunityId).toEqual("2.16.840.1.113883.3.8391");
    expect(response?.documentReference?.[1]?.repositoryUniqueId).toEqual(
      "urn:oid:2.16.840.1.113883.3.9621"
    );
  });

  it("should process the soap fault DR response correctly", async () => {
    const xmlString = fs.readFileSync(path.join(__dirname, "xmls/dr_soap_error.xml"), "utf8");
    const mtomResponse = await createMtomMessageWithoutAttachments(xmlString);
    const response = await processDrResponse({
      drResponse: {
        mtomResponse: mtomResponse,
        gateway: outboundDrRequest.gateway,
        outboundRequest: outboundDrRequest,
      },
    });

    expect(response?.operationOutcome?.issue[0]?.code).toBe("soap:Sender");
  });

  it("should process the registry error DR response correctly", async () => {
    const xmlString = fs.readFileSync(path.join(__dirname, "xmls/dr_registry_error.xml"), "utf8");
    const mtomResponse = await createMtomMessageWithoutAttachments(xmlString);
    const response = await processDrResponse({
      drResponse: {
        mtomResponse: mtomResponse,
        gateway: outboundDrRequest.gateway,
        outboundRequest: outboundDrRequest,
      },
    });
    expect(response.operationOutcome?.issue[0]?.code).toEqual("XDSRegistryError");
  });

  it("should process the empty DR response correctly", async () => {
    const xmlString = fs.readFileSync(path.join(__dirname, "xmls/dr_empty.xml"), "utf8");
    const mtomResponse = await createMtomMessageWithoutAttachments(xmlString);
    const response = await processDrResponse({
      drResponse: {
        mtomResponse: mtomResponse,
        gateway: outboundDrRequest.gateway,
        outboundRequest: outboundDrRequest,
      },
    });
    expect(response.operationOutcome?.issue[0]?.code).toEqual("no-documents-found");
  });
  it("should process response that is not a string correctly", async () => {
    const randomResponse = "This is a bad response and is not xml";
    const mtomResponse = await createMtomMessageWithoutAttachments(randomResponse);
    const response = await processDrResponse({
      drResponse: {
        mtomResponse: mtomResponse,
        gateway: outboundDrRequest.gateway,
        outboundRequest: outboundDrRequest,
      },
    });
    expect(response.operationOutcome?.issue[0]?.severity).toEqual("information");
  });
});

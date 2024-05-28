import fs from "fs";
import path from "path";
import { processDrResponse } from "../xca/process/dr-response";
import { outboundDrRequestMtom, testFiles } from "./constants";
import { S3Utils } from "../../../../aws/s3";
import { createMtomMessageWithAttachments } from "./mtom";

describe("processDRResponse", () => {
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

  testFiles.forEach(file => {
    it(`should correctly create and parse MTOM message for ${file.name}`, async () => {
      const filePath = path.join(__dirname, "./files/", file.name);
      const fileBuffer = fs.readFileSync(filePath);

      const attachmentsData = [{ payload: fileBuffer, mimeType: file.mimeType }];
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
      expect(response.documentReference?.[0]?.contentType).toBe(file.mimeType);
    });
  });

  it.skip("should correctly create and parse MTOM message with XML, PDF, and TIFF attachments", async () => {
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
    console.log("response", JSON.stringify(response, null, 2));

    expect(response).toBeDefined();
    expect(response.documentReference).toHaveLength(3);
    expect(response.documentReference?.[0]?.contentType).toBe(xmlFile.mimeType);
    expect(response.documentReference?.[1]?.contentType).toBe(pdfFile.mimeType);
    expect(response.documentReference?.[2]?.contentType).toBe(tiffFile.mimeType);
  });
});

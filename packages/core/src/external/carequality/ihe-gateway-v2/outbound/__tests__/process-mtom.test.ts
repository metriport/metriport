import fs from "fs";
import path from "path";
import { processDRResponse } from "../xca/process/dr-response";
import { outboundDRRequestMTOM, outboundDRRequestMultiMTOM, testFiles } from "./constants";
import { S3Utils } from "../../../../aws/s3";
import { Config } from "../../../../../util/config";
import { parseMtomContentType, parseMtomHeaders } from "../xca/mtom/parser";
import { creatMtomContentTypeAndPayload } from "../xca/mtom/builder";

describe("mtomContentAndHeaderParsing", () => {
  it("should correctly build and parse MTOM content type and headers", async () => {
    const signedXml = "<xml>test</xml>";
    const { contentType, payload } = creatMtomContentTypeAndPayload(signedXml);
    const parsedContentType = parseMtomContentType(contentType);
    expect(parsedContentType.boundary).toBe("MIMEBoundary782a6cafc4cf4aab9dbf291522804454");
    expect(parsedContentType.type).toBe("application/xop+xml");
    expect(parsedContentType.start).toBe("<doc0@metriport.com>");
    expect(parsedContentType.startInfo).toBe("application/soap+xml");

    // Extract headers from payload
    const headerPart = payload.split("\r\n\r\n")[0] || "";
    const parsedHeaders = parseMtomHeaders(headerPart);
    expect(parsedHeaders.ContentID).toBe("doc0@metriport.com");
    expect(parsedHeaders.ContentType).toBe(
      `application/xop+xml; charset=UTF-8; type="application/soap+xml"`
    );
    expect(parsedHeaders.ContentTransferEncoding).toBe("8bit");
  });
});

describe("processDRResponse for MTOM where there is no actual multipart message and the document is still just in the soap", () => {
  testFiles.forEach(({ name, mimeType, fileExtension }) => {
    const xmlTemplatePath = path.join(__dirname, "./files/mtom-without-multipart.txt");
    const xmlTemplate = fs.readFileSync(xmlTemplatePath, "utf8");

    it(`should process the ${fileExtension} MTOM response correctly`, async () => {
      const fileContent = fs.readFileSync(path.join(__dirname, `./files/${name}`));
      const fileContentB64 = fileContent.toString("base64");
      const modifiedXml = xmlTemplate.replace(
        "<xdsb:Document></xdsb:Document>",
        `<xdsb:Document>${fileContentB64}</xdsb:Document>`
      );

      const response = await processDRResponse({
        drResponse: {
          success: true,
          response: modifiedXml,
          gateway: outboundDRRequestMTOM.gateway,
          outboundRequest: outboundDRRequestMTOM,
          contentType: `multipart/related; type="application/xop+xml";start="<root.message@cxf.apache.org>";boundary="40273fbb68604ecba3d877e21a230ee0";start-info="application/soap+xml"`,
        },
      });

      expect(response.documentReference?.[0]?.contentType).toEqual(mimeType);
    });
    return;
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

    jest.spyOn(S3Utils.prototype, "getFileInfoFromS3").mockImplementation(() =>
      Promise.resolve({
        exists: false,
      })
    );
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it("should process mtom with xml but binary content type correctly", async () => {
    const xmlString = fs.readFileSync(path.join(__dirname, "files/mtom-binary-xml.txt"), "utf8");
    const contentType = `multipart/related; type="application/xop+xml";start="<http://tempuri.org/0>";boundary="uuid:5ef8425b-44e7-4a4c-8144-b8ddacb300f9+id=186535";start-info="application/soap+xml"`;
    const response = await processDRResponse({
      drResponse: {
        success: true,
        response: xmlString,
        gateway: outboundDRRequestMTOM.gateway,
        outboundRequest: outboundDRRequestMTOM,
        contentType,
      },
    });
    expect(response.documentReference?.length).toBe(1);
    expect(response.documentReference?.[0]?.contentType).toBe("application/xml");
  });
  it("should process mtom with xml and xml content type correctly", async () => {
    const xmlString = fs.readFileSync(path.join(__dirname, "files/mtom-xml.txt"), "utf8");
    const contentType = `multipart/related; type="application/xop+xml";start="<0.urn:uuid:2a28fe28-cd7d-44f9-88dd-0ab2a2d80073>";boundary="a1109b32-0907-4c3c-9d61-8b8d846b9983";start-info="application/soap+xml"`;
    const response = await processDRResponse({
      drResponse: {
        success: true,
        response: xmlString,
        gateway: outboundDRRequestMTOM.gateway,
        outboundRequest: outboundDRRequestMTOM,
        contentType,
      },
    });
    expect(response.documentReference?.length).toBe(1);
    expect(response.documentReference?.[0]?.contentType).toBe("application/xml");
  });
  it("should process multiple xml files in a single mtom correctly", async () => {
    const xmlString = fs.readFileSync(path.join(__dirname, "files/multi-mtom.txt"), "utf8");
    const contentType = `multipart/related; type="application/xop+xml";start=""<http://tempuri.org/0>";boundary="uuid:34605f3a-f898-4d62-99a5-c0fc113a7e59+id=51889";start-info="application/soap+xml"`;
    const response = await processDRResponse({
      drResponse: {
        success: true,
        response: xmlString,
        gateway: outboundDRRequestMTOM.gateway,
        outboundRequest: outboundDRRequestMultiMTOM,
        contentType,
      },
    });
    expect(response.documentReference?.length).toBe(2);
  });
  it("should not process non-xml mtom response", async () => {
    const xmlString = fs.readFileSync(path.join(__dirname, "files/mtom-non-xml.txt"), "utf8");
    const contentType = `multipart/related; type="application/xop+xml";start="<0.urn:uuid:2a28fe28-cd7d-44f9-88dd-0ab2a2d80073>";boundary="a1109b32-0907-4c3c-9d61-8b8d846b9983";start-info="application/soap+xml"`;
    const response = await processDRResponse({
      drResponse: {
        success: true,
        response: xmlString,
        gateway: outboundDRRequestMTOM.gateway,
        outboundRequest: outboundDRRequestMultiMTOM,
        contentType,
      },
    });
    expect(response.documentReference?.length).toBe(0);
  });
});

describe.skip("integrationTestProcessDrResponseMTOM", () => {
  const s3Utils = new S3Utils(Config.getAWSRegion());

  it("should upload, print, and delete the XML content correctly to verify the xml is properly uploaded to s3", async () => {
    const xmlString = fs.readFileSync(path.join(__dirname, "files/mtom-binary-xml.txt"), "utf8");
    const contentType = `multipart/related; type="application/xop+xml";start="<http://tempuri.org/0>";boundary="uuid:5ef8425b-44e7-4a4c-8144-b8ddacb300f9+id=186535";start-info="application/soap+xml"`;
    const responseString = `<?xml version="1.0" encoding="UTF-8"?><ClinicalDocument xmlns="urn:hl7-org:v3"></ClinicalDocument>`;
    const response = await processDRResponse({
      drResponse: {
        success: true,
        response: xmlString,
        gateway: outboundDRRequestMTOM.gateway,
        outboundRequest: outboundDRRequestMTOM,
        contentType,
      },
    });

    const key = `${outboundDRRequestMTOM.cxId}/${outboundDRRequestMTOM.patientId}/${response.documentReference?.[0]?.fileName}`;
    const bucket = response.documentReference?.[0]?.fileLocation;

    if (bucket) {
      const fileInfo = await s3Utils.getFileInfoFromS3(key, bucket);
      expect(fileInfo.contentType).toEqual("application/xml");

      const downloadedContent = await s3Utils.downloadFile({ bucket, key });
      expect(downloadedContent.toString()).toEqual(responseString);

      await s3Utils.deleteFile({ bucket, key });
    }

    expect(response.documentReference?.length).toBe(1);
    expect(response.documentReference?.[0]?.contentType).toBe("application/xml");
  });
});

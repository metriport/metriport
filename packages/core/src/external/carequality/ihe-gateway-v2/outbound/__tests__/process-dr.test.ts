import fs from "fs";
import path from "path";
import { v4 as uuidv4 } from "uuid";
import { OutboundDocumentRetrievalResp } from "@metriport/ihe-gateway-sdk";
import { processDRResponse } from "../xca/process/dr-response";
import { outboundDRRequest, testFiles, testFilesForUploadVerification } from "./constants";
import { S3Utils } from "../../../../aws/s3";
import { Config } from "../../../../../util/config";

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
    const response = await processDRResponse({
      drResponse: {
        success: true,
        response: xmlString,
        gateway: outboundDRRequest.gateway,
        outboundRequest: outboundDRRequest,
      },
    });
    expect(response.documentReference?.length).toBe(2);
    expect(response?.documentReference?.[0]?.contentType).toEqual("application/octet-stream");
    expect(response?.documentReference?.[0]?.docUniqueId).toEqual("123456789");
    expect(response?.documentReference?.[0]?.homeCommunityId).toEqual(
      "urn:oid:urn:oid:2.16.840.1.113883.3.9621"
    );
    expect(response?.documentReference?.[0]?.repositoryUniqueId).toEqual(
      "urn:oid:2.16.840.1.113883.3.9621"
    );

    expect(response?.documentReference?.[1]?.contentType).toEqual("application/octet-stream");
    expect(response?.documentReference?.[1]?.docUniqueId).toEqual("987654321");
    expect(response?.documentReference?.[1]?.homeCommunityId).toEqual(
      "urn:oid:urn:oid:2.16.840.1.113883.3.9621"
    );
    expect(response?.documentReference?.[1]?.repositoryUniqueId).toEqual(
      "urn:oid:2.16.840.1.113883.3.9621"
    );
  });

  it("should process the soap fault DR response correctly", async () => {
    const xmlString = fs.readFileSync(path.join(__dirname, "xmls/dr_soap_error.xml"), "utf8");
    const response = await processDRResponse({
      drResponse: {
        success: true,
        response: xmlString,
        gateway: outboundDRRequest.gateway,
        outboundRequest: outboundDRRequest,
      },
    });

    expect(response?.operationOutcome?.issue[0]?.code).toBe("soap:Sender");
  });

  it("should process the registry error DR response correctly", async () => {
    const xmlString = fs.readFileSync(path.join(__dirname, "xmls/dr_registry_error.xml"), "utf8");
    const response = await processDRResponse({
      drResponse: {
        success: true,
        response: xmlString,
        gateway: outboundDRRequest.gateway,
        outboundRequest: outboundDRRequest,
      },
    });
    expect(response.operationOutcome?.issue[0]?.code).toEqual("XDSRegistryError");
  });

  it("should process the empty DR response correctly", async () => {
    const xmlString = fs.readFileSync(path.join(__dirname, "xmls/dr_empty.xml"), "utf8");
    const response = await processDRResponse({
      drResponse: {
        success: true,
        response: xmlString,
        gateway: outboundDRRequest.gateway,
        outboundRequest: outboundDRRequest,
      },
    });
    expect(response.operationOutcome?.issue[0]?.code).toEqual("no-documents-found");
  });
  it("should process response that is not a string correctly", async () => {
    const randomResponse = "This is a bad response and is not xml";

    const response = await processDRResponse({
      drResponse: {
        success: true,
        response: randomResponse,
        gateway: outboundDRRequest.gateway,
        outboundRequest: outboundDRRequest,
      },
    });
    expect(response.operationOutcome?.issue[0]?.severity).toEqual("information");
  });
});

describe.skip("processDRResponse for various file types and verify successful upload without corruption", () => {
  const s3Utils = new S3Utils(Config.getAWSRegion());

  testFiles.forEach(({ name, mimeType, fileExtension }) => {
    const xmlTemplatePath = path.join(__dirname, "./xmls/dr-no-mime-type.xml");
    const xmlTemplate = fs.readFileSync(xmlTemplatePath, "utf8");

    describe(`${name}`, () => {
      class TestContext {
        fileContent: Buffer;
        modifiedXml: string;
        response?: OutboundDocumentRetrievalResp;
        key: string;
        bucket: string | null | undefined;
        shouldVerifyUpload: boolean;

        constructor(fileName: string) {
          this.fileContent = fs.readFileSync(path.join(__dirname, `./files/${fileName}`));
          const fileContentB64 = this.fileContent.toString("base64");
          this.modifiedXml = xmlTemplate.replace(
            "<Document></Document>",
            `<Document>${fileContentB64}</Document>`
          );
          this.key = "";
          this.bucket = "";
          this.shouldVerifyUpload = testFilesForUploadVerification.some(
            file => file.name === fileName
          );
        }

        async processDRResponse() {
          this.response = await processDRResponse({
            drResponse: {
              success: true,
              response: this.modifiedXml,
              gateway: outboundDRRequest.gateway,
              outboundRequest: {
                ...outboundDRRequest,
                documentReference: outboundDRRequest.documentReference.map(docRef => ({
                  ...docRef,
                  metriportId: uuidv4(),
                })),
              },
            },
          });

          this.key = this.response.documentReference?.[0]?.fileName || "";
          this.bucket = this.response.documentReference?.[0]?.fileLocation;
        }

        async verifyUpload() {
          if (!this.bucket || !this.shouldVerifyUpload) {
            return;
          }
          const fileInfo = await s3Utils.getFileInfoFromS3(this.key, this.bucket);
          expect(fileInfo.contentType).toEqual(mimeType);

          const downloadedContent = await s3Utils.downloadFile({
            bucket: this.bucket,
            key: this.key,
          });
          expect(downloadedContent).toEqual(this.fileContent);

          await s3Utils.deleteFile({ bucket: this.bucket, key: this.key });
        }
      }

      let testContext: TestContext;

      beforeAll(async () => {
        testContext = new TestContext(name);
        await testContext.processDRResponse();
      }, 20000);

      it(`should process the ${fileExtension} DR response correctly`, () => {
        expect(testContext.response?.documentReference?.[0]?.contentType).toEqual(mimeType);
      });

      it(`should verify the ${fileExtension} file upload to S3 without corruption if applicable`, async () => {
        await testContext.verifyUpload();
      }, 20000);
    });
  });
});

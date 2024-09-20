import fs from "fs";
import path from "path";
import { v4 as uuidv4 } from "uuid";
import { S3Utils } from "../../../../aws/s3";
import { schemaErrorCode } from "../../../error";
import { processDrResponse } from "../xca/process/dr-response";
import { outboundDrRequest, outboundDrRequestMtom, testFiles } from "./constants";
import { createMtomMessageWithAttachments, createMtomMessageWithoutAttachments } from "./mtom";

beforeAll(() => {
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

afterAll(() => {
  jest.restoreAllMocks();
});

describe("dr-response", () => {
  describe("processDrResponse for MTOM with/without attachments and for different file types", () => {
    testFiles.forEach(({ name, mimeType, fileExtension }) => {
      it(`[mtom without attachments]: should process the ${fileExtension} DR response correctly`, async () => {
        const filePath = path.join(__dirname, "./files/", name);
        const fileBuffer = fs.readFileSync(filePath);

        const attachmentsData = [{ payload: fileBuffer, mimeType: mimeType }];
        const mtomAttachments = await createMtomMessageWithAttachments(attachmentsData);
        const response = await processDrResponse({
          response: {
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
        const xmlTemplatePath = path.join(__dirname, "./xmls/dr-insert-b64.xml");
        const xmlTemplate = fs.readFileSync(xmlTemplatePath, "utf8");

        const fileContent = fs.readFileSync(path.join(__dirname, `./files/${name}`));
        const fileContentB64 = fileContent.toString("base64");
        const modifiedXml = xmlTemplate.replace(
          "<Document></Document>",
          `<Document>${fileContentB64}</Document>`
        );

        const mtomResponse = await createMtomMessageWithoutAttachments(modifiedXml);
        const response = await processDrResponse({
          response: {
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
        response: {
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
  describe("processDrResponse", () => {
    it("should process multiple DR responses correctly", async () => {
      const xmlString = fs.readFileSync(path.join(__dirname, "xmls/dr_success.xml"), "utf8");
      const mtomResponse = await createMtomMessageWithoutAttachments(xmlString);
      const response = await processDrResponse({
        response: {
          mtomResponse: mtomResponse,
          gateway: outboundDrRequest.gateway,
          outboundRequest: outboundDrRequest,
        },
      });
      expect(response.documentReference?.length).toBe(2);
      expect(response?.documentReference?.[0]?.contentType).toEqual("application/octet-stream");
      expect(response?.documentReference?.[0]?.docUniqueId).toEqual("123456789");
      expect(response?.documentReference?.[0]?.homeCommunityId).toEqual("2.16.840.1.113883.3.9621");
      expect(response?.documentReference?.[0]?.repositoryUniqueId).toEqual(
        "2.16.840.1.113883.3.9621"
      );

      expect(response?.documentReference?.[1]?.contentType).toEqual("application/octet-stream");
      expect(response?.documentReference?.[1]?.docUniqueId).toEqual("987654321");
      expect(response?.documentReference?.[1]?.homeCommunityId).toEqual("2.16.840.1.113883.3.9621");
      expect(response?.documentReference?.[1]?.repositoryUniqueId).toEqual(
        "2.16.840.1.113883.3.9621"
      );
    });

    it("should process the partial success DR response correctly", async () => {
      const xmlString = fs.readFileSync(
        path.join(__dirname, "xmls/dr-partial-success.xml"),
        "utf8"
      );
      const mtomResponse = await createMtomMessageWithoutAttachments(xmlString);

      const missingMetriportId1 = uuidv4();
      const missingMetriportId2 = uuidv4();
      const missingDocUniqueId1 = uuidv4();
      const missingDocUniqueId2 = uuidv4();
      const modifiedOutboundRequest = {
        ...outboundDrRequest,
        documentReference: [
          ...outboundDrRequest.documentReference,
          {
            metriportId: missingMetriportId1,
            docUniqueId: missingDocUniqueId1,
            homeCommunityId: "2.16.840.1.113883.3.8391",
            repositoryUniqueId: "2.16.840.1.113883.3.8391.1000.1",
          },
          {
            docUniqueId: missingDocUniqueId2,
            metriportId: missingMetriportId2,
            homeCommunityId: "2.16.840.1.113883.3.8391",
            repositoryUniqueId: "2.16.840.1.113883.3.8391.1000.1",
          },
        ],
      };
      const response = await processDrResponse({
        response: {
          mtomResponse: mtomResponse,
          gateway: outboundDrRequest.gateway,
          outboundRequest: modifiedOutboundRequest,
        },
      });
      expect(response.documentReference?.length).toBe(2);
      expect(response?.documentReference?.[0]?.contentType).toEqual("application/octet-stream");
      expect(response?.documentReference?.[0]?.docUniqueId).toEqual("123456789");
      expect(response?.documentReference?.[0]?.homeCommunityId).toEqual("2.16.840.1.113883.3.9621");
      expect(response?.documentReference?.[0]?.repositoryUniqueId).toEqual(
        "2.16.840.1.113883.3.9621"
      );

      expect(response?.documentReference?.[1]?.contentType).toEqual("application/octet-stream");
      expect(response?.documentReference?.[1]?.docUniqueId).toEqual("987654321");
      expect(response?.documentReference?.[1]?.homeCommunityId).toEqual("2.16.840.1.113883.3.9621");
      expect(response?.documentReference?.[1]?.repositoryUniqueId).toEqual(
        "2.16.840.1.113883.3.9621"
      );

      expect(response.operationOutcome?.issue).toBeDefined();
      expect(response.operationOutcome?.issue).toHaveLength(2);

      const issueIds = response.operationOutcome?.issue.map(issue => issue.id);
      const detailIds = response.operationOutcome?.issue.map(issue => issue.details?.id);
      expect(issueIds).toContain(missingMetriportId1);
      expect(issueIds).toContain(missingMetriportId2);
      expect(detailIds).toContain(missingDocUniqueId1);
      expect(detailIds).toContain(missingDocUniqueId2);

      // Additional check to ensure each issue has the correct code
      response.operationOutcome?.issue.forEach(issue => {
        expect(issue.code).toBe("document-not-found");
      });
    });

    it("should process the soap fault DR response correctly", async () => {
      const xmlString = fs.readFileSync(path.join(__dirname, "xmls/dr_soap_error.xml"), "utf8");
      const mtomResponse = await createMtomMessageWithoutAttachments(xmlString);
      const response = await processDrResponse({
        response: {
          mtomResponse: mtomResponse,
          gateway: outboundDrRequest.gateway,
          outboundRequest: outboundDrRequest,
        },
      });
      const issueIds = response.operationOutcome?.issue.map(issue => issue.id);
      const detailIds = response.operationOutcome?.issue.map(issue => issue.details?.id);

      expect(response?.operationOutcome?.issue[0]?.code).toEqual(schemaErrorCode);

      expect(issueIds).toContain(outboundDrRequest?.documentReference?.[0]?.metriportId);
      expect(detailIds).toContain(outboundDrRequest?.documentReference?.[0]?.docUniqueId);
      expect(issueIds).toContain(outboundDrRequest?.documentReference?.[1]?.metriportId);
      expect(detailIds).toContain(outboundDrRequest?.documentReference?.[1]?.docUniqueId);
    });

    it("should process the registry error DR response correctly", async () => {
      const xmlString = fs.readFileSync(path.join(__dirname, "xmls/dr_registry_error.xml"), "utf8");
      const mtomResponse = await createMtomMessageWithoutAttachments(xmlString);
      const response = await processDrResponse({
        response: {
          mtomResponse: mtomResponse,
          gateway: outboundDrRequest.gateway,
          outboundRequest: outboundDrRequest,
        },
      });
      expect(response.operationOutcome?.issue[0]?.code).toEqual("XDSRegistryError");

      const issueIds = response.operationOutcome?.issue.map(issue => issue.id);
      const detailIds = response.operationOutcome?.issue.map(issue => issue.details?.id);
      expect(issueIds).toContain(outboundDrRequest?.documentReference?.[0]?.metriportId);
      expect(detailIds).toContain(outboundDrRequest?.documentReference?.[0]?.docUniqueId);
      expect(issueIds).toContain(outboundDrRequest?.documentReference?.[1]?.metriportId);
      expect(detailIds).toContain(outboundDrRequest?.documentReference?.[1]?.docUniqueId);
    });

    it("should process the empty DR response correctly", async () => {
      const xmlString = fs.readFileSync(path.join(__dirname, "xmls/dr_empty.xml"), "utf8");
      const mtomResponse = await createMtomMessageWithoutAttachments(xmlString);
      const response = await processDrResponse({
        response: {
          mtomResponse: mtomResponse,
          gateway: outboundDrRequest.gateway,
          outboundRequest: outboundDrRequest,
        },
      });
      const issueIds = response.operationOutcome?.issue.map(issue => issue.id);
      const detailIds = response.operationOutcome?.issue.map(issue => issue.details?.id);

      expect(response.operationOutcome?.issue[0]?.code).toEqual("document-not-found");
      expect(issueIds).toContain(outboundDrRequest?.documentReference?.[0]?.metriportId);
      expect(detailIds).toContain(outboundDrRequest?.documentReference?.[0]?.docUniqueId);
      expect(issueIds).toContain(outboundDrRequest?.documentReference?.[1]?.metriportId);
      expect(detailIds).toContain(outboundDrRequest?.documentReference?.[1]?.docUniqueId);
    });
    it("should process response that is not a string correctly", async () => {
      const randomResponse = "This is a bad response and is not xml";
      const mtomResponse = await createMtomMessageWithoutAttachments(randomResponse);
      const response = await processDrResponse({
        response: {
          mtomResponse: mtomResponse,
          gateway: outboundDrRequest.gateway,
          outboundRequest: outboundDrRequest,
        },
      });
      const issueIds = response.operationOutcome?.issue.map(issue => issue.id);
      const detailIds = response.operationOutcome?.issue.map(issue => issue.details?.id);

      expect(response.operationOutcome?.issue[0]?.code).toEqual(schemaErrorCode);
      expect(issueIds).toContain(outboundDrRequest?.documentReference?.[0]?.metriportId);
      expect(detailIds).toContain(outboundDrRequest?.documentReference?.[0]?.docUniqueId);
      expect(issueIds).toContain(outboundDrRequest?.documentReference?.[1]?.metriportId);
      expect(detailIds).toContain(outboundDrRequest?.documentReference?.[1]?.docUniqueId);
    });
  });
});

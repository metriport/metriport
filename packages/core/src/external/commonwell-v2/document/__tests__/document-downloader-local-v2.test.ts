import { faker } from "@faker-js/faker";
import { CommonWellAPI } from "@metriport/commonwell-sdk";
import * as AWS from "aws-sdk";
import { ManagedUpload } from "aws-sdk/clients/s3";
import {
  JPEG_MIME_TYPE,
  OCTET_MIME_TYPE,
  PDF_MIME_TYPE,
  PNG_MIME_TYPE,
  TIFF_MIME_TYPE,
  TXT_MIME_TYPE,
} from "../../../../util/mime";
import { mockCapture } from "../../../../util/__tests__/capture";
import { S3Utils } from "../../../aws/s3";
import {
  getCdaWithB64EncodedJpeg,
  getCdaWithB64EncodedOctet,
  getCdaWithB64EncodedPdf,
  getCdaWithB64EncodedPng,
  getCdaWithB64EncodedText,
  getCdaWithB64EncodedTiff,
  getCdaWithEmptyNonXmlBody,
  getCdaWithTwoNonXmlBodyTags,
  getCdaWithTwoTextTagsUnderNonXmlBodyTag,
} from "../../../cda/__tests__/examples";
import {
  DocumentDownloaderLocalConfig,
  DocumentDownloaderLocalV2,
} from "../../../commonwell-v2/document/document-downloader-local-v2";
import { FileInfo } from "../../../commonwell/document/document-downloader";

describe("document-downloader-local", () => {
  describe("parseXmlFile", () => {
    let s3Upload_mock: jest.SpyInstance;
    const capture = mockCapture();
    beforeEach(() => {
      s3Upload_mock = jest.spyOn(AWS.S3.prototype, "upload").mockReturnValue({
        promise: jest.fn().mockResolvedValue({
          Location: faker.internet.url(),
          ETag: faker.string.alphanumeric(10),
          Bucket: faker.lorem.word(),
          Key: faker.lorem.word(),
        }),
        abort: jest.fn(),
        send: jest.fn(),
        on: jest.fn(),
      } as ManagedUpload);
      jest.spyOn(S3Utils.prototype, "getFileInfoFromS3").mockResolvedValue({
        exists: true,
        size: 0,
        contentType: faker.system.mimeType(),
        createdAt: undefined,
        metadata: undefined,
      });
      const mockedCapture = mockCapture();
      capture.error = mockedCapture.error;
      capture.message = mockedCapture.message;
    });
    afterEach(() => {
      jest.resetAllMocks();
    });
    afterAll(() => {
      jest.restoreAllMocks();
    });

    const downloader = new DocumentDownloaderLocalV2({
      region: "us-east-1",
      bucketName: faker.lorem.word(),
      commonWell: {
        api: {} as CommonWellAPI,
      },
      capture,
    });
    const downloadedFile = {
      bucket: faker.lorem.word(),
      key: faker.lorem.sentence(),
      location: faker.internet.url(),
      size: faker.number.int(),
      contentType: faker.system.mimeType(),
    };
    const requestedFileInfo: FileInfo = {
      name: faker.lorem.word(),
      location: faker.internet.url(),
    };

    it("uses the first nonXmlBody tag when more than one nonXmlBody", async () => {
      const res = await downloader.parseXmlFile({
        contents: getCdaWithTwoNonXmlBodyTags(),
        ...downloadedFile,
        requestedFileInfo,
      });
      expect(res).toBeTruthy();
      expect(s3Upload_mock).toHaveBeenCalledWith(
        expect.objectContaining({ ContentType: TIFF_MIME_TYPE })
      );
      expect(capture.message).toHaveBeenCalledWith(
        `Multiple nonXmlBody inside CDA`,
        expect.objectContaining({
          extra: expect.anything(),
          level: "warning",
        })
      );
    });

    it("uses the first text tag when more than one under nonXmlBody", async () => {
      const res = await downloader.parseXmlFile({
        contents: getCdaWithTwoTextTagsUnderNonXmlBodyTag(),
        ...downloadedFile,
        requestedFileInfo,
      });
      expect(res).toBeTruthy();
      expect(s3Upload_mock).toHaveBeenCalledWith(
        expect.objectContaining({ ContentType: TIFF_MIME_TYPE })
      );
      expect(capture.message).toHaveBeenCalledWith(
        `Multiple text inside CDA.nonXmlBody`,
        expect.objectContaining({
          extra: expect.anything(),
          level: "warning",
        })
      );
    });

    it("returns original file when gets empty nonXmlBody", async () => {
      const res = await downloader.parseXmlFile({
        contents: getCdaWithEmptyNonXmlBody(),
        ...downloadedFile,
        requestedFileInfo,
      });
      expect(res).toBeTruthy();
      expect(res).toEqual(downloadedFile);
      expect(s3Upload_mock).not.toHaveBeenCalled();
    });

    it("parses b64 encoded txt and returns txt content type", async () => {
      const res = await downloader.parseXmlFile({
        contents: getCdaWithB64EncodedText(),
        ...downloadedFile,
        requestedFileInfo,
      });
      expect(res).toBeTruthy();
      expect(s3Upload_mock).toHaveBeenCalledWith(
        expect.objectContaining({ ContentType: TXT_MIME_TYPE })
      );
    });

    it("parses b64 encoded tiff and returns tiff content type", async () => {
      const res = await downloader.parseXmlFile({
        contents: getCdaWithB64EncodedTiff(),
        ...downloadedFile,
        requestedFileInfo,
      });
      expect(res).toBeTruthy();
      expect(s3Upload_mock).toHaveBeenCalledWith(
        expect.objectContaining({ ContentType: TIFF_MIME_TYPE })
      );
    });

    it("parses b64 encoded pdf and returns pdf content type", async () => {
      const res = await downloader.parseXmlFile({
        contents: getCdaWithB64EncodedPdf(),
        ...downloadedFile,
        requestedFileInfo,
      });
      expect(res).toBeTruthy();
      expect(s3Upload_mock).toHaveBeenCalledWith(
        expect.objectContaining({ ContentType: PDF_MIME_TYPE })
      );
    });

    it("parses b64 encoded png and returns png content type", async () => {
      const res = await downloader.parseXmlFile({
        contents: getCdaWithB64EncodedPng(),
        ...downloadedFile,
        requestedFileInfo,
      });
      expect(res).toBeTruthy();
      expect(s3Upload_mock).toHaveBeenCalledWith(
        expect.objectContaining({ ContentType: PNG_MIME_TYPE })
      );
    });

    it("parses b64 encoded jpeg and returns jpeg content type", async () => {
      const res = await downloader.parseXmlFile({
        contents: getCdaWithB64EncodedJpeg(),
        ...downloadedFile,
        requestedFileInfo,
      });
      expect(res).toBeTruthy();
      expect(s3Upload_mock).toHaveBeenCalledWith(
        expect.objectContaining({ ContentType: JPEG_MIME_TYPE })
      );
    });

    it("parses b64 encoded octet and returns octet content type", async () => {
      const res = await downloader.parseXmlFile({
        contents: getCdaWithB64EncodedOctet(),
        ...downloadedFile,
        requestedFileInfo,
      });
      expect(res).toBeTruthy();
      expect(s3Upload_mock).toHaveBeenCalledWith(
        expect.objectContaining({ ContentType: OCTET_MIME_TYPE })
      );
    });
  });

  describe("downloadFromCommonwellIntoS3", () => {
    it("resets the stream if downloadDocumentFromCW fails and triggers resetStream", async () => {
      const mockS3Client = { upload: jest.fn().mockReturnValue({ promise: jest.fn() }) };
      const mockS3Utils = {
        getFileInfoFromS3: jest.fn().mockResolvedValue({ size: 1, contentType: "text/xml" }),
      };
      const mockCwApi = { retrieveDocument: jest.fn() };
      const config: DocumentDownloaderLocalConfig = {
        region: "us-east-1",
        bucketName: "bucket",
        commonWell: { api: mockCwApi as unknown as CommonWellAPI },
      };

      // eslint-disable-next-line @typescript-eslint/no-var-requires
      const { DocumentDownloaderLocalV2 } = require("../document-downloader-local-v2");
      const downloader = new DocumentDownloaderLocalV2(config);

      downloader.s3client = mockS3Client as unknown as AWS.S3;
      downloader.s3Utils = mockS3Utils as unknown as S3Utils;

      const getUploadStreamToS3Spy = jest
        .spyOn(downloader, "getUploadStreamToS3")
        .mockImplementation(() => ({
          // eslint-disable-next-line @typescript-eslint/no-var-requires
          writeStream: new (require("stream").PassThrough)(),
          promise: Promise.resolve({
            Key: "key",
            Bucket: "bucket",
            Location: "location",
          }),
        }));

      // Simulate downloadDocumentFromCW calling resetStream
      const downloadDocumentFromCWSpy = jest
        .spyOn(downloader, "downloadDocumentFromCW")
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        .mockImplementation(async (...args: any[]) => {
          const arg = args[0] || {};
          if (typeof arg.resetStream === "function") {
            arg.resetStream();
          }
        });

      const document = { location: "loc", mimeType: "text/xml", id: "id" } as unknown as Document;
      const fileInfo: import("../../../commonwell/document/document-downloader").FileInfo = {
        name: "file.xml",
        location: "bucket",
      };

      await downloader.downloadFromCommonwellIntoS3(document, fileInfo);

      expect(getUploadStreamToS3Spy).toHaveBeenCalledTimes(2); // initial + reset
      expect(downloadDocumentFromCWSpy).toHaveBeenCalled();
    });
  });
});

import { faker } from "@faker-js/faker";
import { CommonWellAPI, organizationQueryMeta } from "@metriport/commonwell-sdk";
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
import { FileInfo } from "../document-downloader";
import { DocumentDownloaderLocal } from "../document-downloader-local";

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

    const queryMeta = organizationQueryMeta(faker.company.name(), {
      npi: faker.string.alpha(10),
    });
    const downloader = new DocumentDownloaderLocal({
      region: "us-east-1",
      bucketName: faker.lorem.word(),
      commonWell: {
        api: {} as CommonWellAPI,
        queryMeta,
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
      expect(capture.message).toHaveBeenCalledWith(
        `No b64 found in xml`,
        expect.objectContaining({
          extra: expect.anything(),
          level: "warning",
        })
      );
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
});

import { CommonWellAPI, CommonwellError, organizationQueryMeta } from "@metriport/commonwell-sdk";
import AWS from "aws-sdk";
import * as stream from "stream";
import { DOMParser } from "xmldom";
import { MetriportError } from "../../../util/error/metriport-error";
import { isMimeTypeXML } from "../../../util/mime";
import { makeS3Client, S3Utils } from "../../aws/s3";
import {
  Document,
  DocumentDownloader,
  DocumentDownloaderConfig,
  DownloadResult,
  FileInfo,
} from "./document-downloader";
import NotFoundError from "../../../util/error/not-found";
import { detectFileType, isContentTypeAccepted } from "./document-file-type-detector";

export type DocumentDownloaderLocalConfig = DocumentDownloaderConfig & {
  commonWell: {
    api: CommonWellAPI;
    queryMeta: ReturnType<typeof organizationQueryMeta>;
  };
};

export class DocumentDownloaderLocal extends DocumentDownloader {
  readonly s3client: AWS.S3;
  readonly s3Utils: S3Utils;
  readonly cwApi: CommonWellAPI;
  readonly cwQueryMeta: ReturnType<typeof organizationQueryMeta>;

  constructor(config: DocumentDownloaderLocalConfig) {
    super(config);
    this.s3client = makeS3Client(config.region);
    this.cwApi = config.commonWell.api;
    this.cwQueryMeta = config.commonWell.queryMeta;
    this.s3Utils = new S3Utils(config.region);
  }

  override async download({
    document,
    fileInfo,
  }: {
    document: Document;
    fileInfo: FileInfo;
  }): Promise<DownloadResult> {
    let downloadedDocument = "";
    //eslint-disable-next-line @typescript-eslint/no-explicit-any
    const onData = (chunk: any) => {
      downloadedDocument += chunk;
    };
    const onEnd = () => {
      console.log("Finished downloading document");
    };
    let downloadResult = await this.downloadFromCommonwellIntoS3(document, fileInfo, onData, onEnd);

    // Check if the detected file type is in the accepted content types
    if (!isContentTypeAccepted(document)) {
      // If not, update the content type in S3
      console.log(
        `Updating content type in S3 ${fileInfo.name} for previous mimeType: ${document.mimeType}`
      );
      const detectedFileType = detectFileType(Buffer.from(downloadedDocument));
      await this.updateContentTypeInS3(downloadResult.bucket, downloadResult.key, detectedFileType);
      const fileDetailsUpdated = await this.s3Utils.getFileInfoFromS3(
        downloadResult.key,
        downloadResult.bucket
      );
      downloadResult = { ...downloadResult, ...fileDetailsUpdated };
    }

    const newlyDownloadedFile: DownloadResult = {
      bucket: downloadResult.bucket,
      key: downloadResult.key,
      location: downloadResult.location,
      size: downloadResult.size,
      contentType: downloadResult.contentType,
    };

    if (downloadedDocument && isMimeTypeXML(document.mimeType)) {
      return this.parseXmlFile({
        ...newlyDownloadedFile,
        contents: downloadedDocument,
        requestedFileInfo: fileInfo,
      });
    }
    return newlyDownloadedFile;
  }

  /**
   * Parses the XML file, checking if there's an embedded PDF inside it.
   * If it does, it uploads the PDF to S3 and returns the PDF file info instead of the originally
   * downloaded XML file.
   */
  async parseXmlFile({
    contents,
    requestedFileInfo,
    ...downloadedFile
  }: DownloadResult & { contents: string; requestedFileInfo: FileInfo }): Promise<DownloadResult> {
    const parser = new DOMParser();
    const document = parser.parseFromString(contents, "text/xml");

    const nonXMLBodies = document.getElementsByTagName("nonXMLBody");
    if (nonXMLBodies.length > 1) {
      const msg = `Multiple nonXmlBody inside CDA`;
      console.log(msg);
      this.config.capture &&
        this.config.capture.message(msg, {
          extra: {
            context: `documentDownloaderLocal.parseXmlFile`,
            fileInfo: requestedFileInfo,
          },
          level: "warning",
        });
    }

    const nonXMLBody = nonXMLBodies[0];
    if (!nonXMLBody) return downloadedFile;

    const xmlBodyTexts = nonXMLBody.getElementsByTagName("text");
    if (xmlBodyTexts.length > 1) {
      const msg = `Multiple text inside CDA.nonXmlBody`;
      console.log(msg);
      this.config.capture &&
        this.config.capture.message(msg, {
          extra: {
            context: `documentDownloaderLocal.parseXmlFile`,
            fileInfo: requestedFileInfo,
          },
          level: "warning",
        });
    }

    const b64 = xmlBodyTexts[0]?.textContent;
    if (!b64) {
      const msg = `No b64 found in xml`;
      console.log(msg);
      this.config.capture &&
        this.config.capture.message(msg, {
          extra: {
            context: `documentDownloaderLocal.parseXmlFile`,
            fileInfo: requestedFileInfo,
          },
          level: "warning",
        });
      return downloadedFile;
    }

    const b64Buff = Buffer.from(b64, "base64");
    const newFileName = this.getNewFileName(requestedFileInfo.name, "pdf");

    const b64Upload = await this.s3client
      .upload({
        Bucket: this.config.bucketName,
        Key: newFileName,
        Body: b64Buff,
        ContentType: "application/pdf",
      })
      .promise();
    const b64FileInfo = await this.s3Utils.getFileInfoFromS3(b64Upload.Key, b64Upload.Bucket);

    return {
      bucket: b64Upload.Bucket,
      key: b64Upload.Key,
      location: b64Upload.Location,
      size: b64FileInfo.size,
      contentType: b64FileInfo.contentType,
    };
  }

  async downloadFromCommonwellIntoS3(
    document: Document,
    fileInfo: FileInfo,
    //eslint-disable-next-line @typescript-eslint/no-explicit-any
    onDataFn?: (chunk: any) => void,
    onEndFn?: () => void
  ): Promise<{
    key: string;
    bucket: string;
    location: string;
    size: number | undefined;
    contentType: string | undefined;
  }> {
    const { writeStream, promise } = this.getUploadStreamToS3(
      fileInfo.name,
      fileInfo.location,
      document.mimeType
    );

    onDataFn && writeStream.on("data", onDataFn);
    onEndFn && writeStream.on("end", onEndFn);

    await this.downloadDocumentFromCW({
      location: document.location,
      stream: writeStream,
    });

    const uploadResult = await promise;

    console.log(`Uploaded ${document.id} to ${uploadResult.Location}`);

    const { size, contentType } = await this.s3Utils.getFileInfoFromS3(
      uploadResult.Key,
      uploadResult.Bucket
    );

    return {
      key: uploadResult.Key,
      bucket: uploadResult.Bucket,
      location: uploadResult.Location,
      size,
      contentType,
    };
  }

  private getNewFileName(fileName: string, newExtension: string) {
    const fileNameParts = fileName.split(".");
    fileNameParts.pop();
    return fileNameParts.join(".") + "." + newExtension;
  }

  protected getUploadStreamToS3(s3FileName: string, s3FileLocation: string, contentType?: string) {
    const pass = new stream.PassThrough();
    return {
      writeStream: pass,
      promise: this.s3client
        .upload({
          Bucket: s3FileLocation,
          Key: s3FileName,
          Body: pass,
          ContentType: contentType ? contentType : "",
        })
        .promise(),
    };
  }

  protected async downloadDocumentFromCW({
    location,
    stream,
  }: {
    location: string;
    stream: stream.Writable;
  }): Promise<void> {
    try {
      await this.cwApi.retrieveDocument(this.cwQueryMeta, location, stream);
    } catch (error) {
      const additionalInfo = {
        cwReferenceHeader: this.cwApi.lastReferenceHeader,
        documentLocation: location,
      };
      if (error instanceof CommonwellError && error.cause?.response?.status === 404) {
        const msg = "CW - Document not found";
        console.log(`${msg} - ${JSON.stringify(additionalInfo)}`);
        throw new NotFoundError(msg, undefined, additionalInfo);
      }
      this.config.capture &&
        this.config.capture.error(error, { extra: { ...additionalInfo, error } });
      throw new MetriportError(`CW - Error downloading document`, error, additionalInfo);
    }
  }

  protected async updateContentTypeInS3(
    bucket: string,
    key: string,
    newContentType: string
  ): Promise<void> {
    const copySource = encodeURIComponent(bucket + "/" + key);

    await this.s3client
      .copyObject({
        Bucket: bucket,
        Key: key,
        CopySource: copySource,
        ContentType: newContentType,
        MetadataDirective: "REPLACE", // This is important to replace the metadata
      })
      .promise();
  }
}

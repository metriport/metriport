import { PutObjectCommand, PutObjectCommandOutput } from "@aws-sdk/client-s3";
import { CommonWellAPI, CommonwellError } from "@metriport/commonwell-sdk";
import {
  emptyFunction,
  errorToString,
  executeWithNetworkRetries,
  getNetworkErrorDetails,
  MetriportError,
  NotFoundError,
} from "@metriport/shared";
import path from "path";
import * as stream from "stream";
import { DOMParser } from "xmldom";
import { detectFileType } from "../../../util/file-type";
import { out } from "../../../util/log";
import { isMimeTypeXML } from "../../../util/mime";
import { S3Utils } from "../../aws/s3";
import {
  Document,
  DocumentDownloader,
  DocumentDownloaderConfig,
  DownloadResult,
  FileInfo,
} from "../../commonwell/document/document-downloader";

export type DocumentDownloaderLocalConfig = DocumentDownloaderConfig & {
  commonWell: {
    api: CommonWellAPI;
  };
};

export class DocumentDownloaderLocalV2 extends DocumentDownloader {
  readonly s3Utils: S3Utils;
  readonly cwApi: CommonWellAPI;

  constructor(config: DocumentDownloaderLocalConfig) {
    super(config);
    this.cwApi = config.commonWell.api;
    this.s3Utils = new S3Utils(config.region);
  }

  override async download({
    sourceDocument,
    destinationFileInfo,
    cxId,
  }: {
    sourceDocument: Document;
    destinationFileInfo: FileInfo;
    cxId: string;
  }): Promise<DownloadResult> {
    const { log } = out("S3.download.v2 cxId: " + cxId);
    const downloadedDocumentInitialValue = Buffer.alloc(0);
    let downloadedBuffer = downloadedDocumentInitialValue;

    //eslint-disable-next-line @typescript-eslint/no-explicit-any
    function onData(chunk: any) {
      downloadedBuffer = Buffer.concat([downloadedBuffer, chunk]);
    }
    function onEnd() {
      log("Finished downloading document");
    }
    function onReset() {
      downloadedBuffer = downloadedDocumentInitialValue;
    }
    let downloadResult = await this.downloadFromCommonwellIntoS3(
      sourceDocument,
      destinationFileInfo,
      onData,
      onEnd,
      onReset
    );

    // Check if the detected file type is in the accepted content types and update it if not
    downloadResult = await this.checkAndUpdateMimeType({
      sourceDocument,
      destinationFileInfo,
      downloadedBuffer,
      downloadResult,
    });

    const newlyDownloadedFile: DownloadResult = {
      bucket: downloadResult.bucket,
      key: downloadResult.key,
      location: downloadResult.location,
      size: downloadResult.size,
      contentType: downloadResult.contentType,
    };

    if (downloadedBuffer.length > 0 && isMimeTypeXML(downloadResult.contentType)) {
      return this.parseXmlFile({
        ...newlyDownloadedFile,
        contents: downloadedBuffer.toString("utf-8"),
        requestedFileInfo: destinationFileInfo,
      });
    }
    return newlyDownloadedFile;
  }

  /**
   * Checks if the content type of a downloaded document is accepted. If not accepted, updates the content type
   * and extension in S3 and returns the updated download result.
   */
  async checkAndUpdateMimeType({
    sourceDocument,
    destinationFileInfo,
    downloadedBuffer,
    downloadResult,
  }: {
    sourceDocument: Document;
    destinationFileInfo: FileInfo;
    downloadedBuffer: Buffer;
    downloadResult: DownloadResult;
  }): Promise<DownloadResult> {
    const { log } = out("checkAndUpdateMimeType.v2");

    const old_extension = path.extname(destinationFileInfo.name);
    const { mimeType, fileExtension } = detectFileType(downloadedBuffer);

    // If the file type/extension has not changed
    if (mimeType === sourceDocument.mimeType && old_extension === fileExtension) {
      return downloadResult;
    }

    // If the file type has changed
    log(
      `Updating content type in S3 ${destinationFileInfo.name} from previous mimeType: ${sourceDocument.mimeType} to detected mimeType ${mimeType} and ${fileExtension}`
    );
    const newKey = await this.s3Utils.updateContentTypeInS3(
      downloadResult.bucket,
      downloadResult.key,
      mimeType,
      fileExtension
    );
    const newLocation = downloadResult.location.replace(`${downloadResult.key}`, `${newKey}`);
    const fileDetailsUpdated = await this.s3Utils.getFileInfoFromS3(newKey, downloadResult.bucket);

    return {
      ...downloadResult,
      ...fileDetailsUpdated,
      key: newKey,
      location: newLocation,
    };
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
    const { log } = out("parseXmlFile.v2");
    const parser = new DOMParser();
    const document = parser.parseFromString(contents, "text/xml");

    const nonXMLBodies = document.getElementsByTagName("nonXMLBody");
    if (nonXMLBodies.length > 1) {
      const msg = `Multiple nonXmlBody inside CDA`;
      log(msg);
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
      log(msg);
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
      log(`No b64 found in xml. File info: ${JSON.stringify(requestedFileInfo)}`);
      return downloadedFile;
    }

    const b64Buff = Buffer.from(b64, "base64");

    // Alternativelly we can use the provided mediaType and calculate the extension from it
    // const providedContentType = xmlBodyTexts[0]?.attributes?.getNamedItem("mediaType")?.value;
    const { mimeType, fileExtension } = detectFileType(b64Buff);
    const newFileName = this.getNewFileName(requestedFileInfo.name, fileExtension);

    const b64Upload = await this.s3Utils.uploadFile({
      bucket: this.config.bucketName,
      key: newFileName,
      file: b64Buff,
      contentType: mimeType,
    });
    const b64FileInfo = await this.s3Utils.getFileInfoFromS3(b64Upload.key, b64Upload.bucket);

    return {
      bucket: b64Upload.bucket,
      key: b64Upload.key,
      location: b64Upload.location,
      size: b64FileInfo.size,
      contentType: b64FileInfo.contentType,
    };
  }

  async downloadFromCommonwellIntoS3(
    sourceDocument: Document,
    destinationFileInfo: FileInfo,
    //eslint-disable-next-line @typescript-eslint/no-explicit-any
    onDataFn?: (chunk: any) => void,
    onEndFn?: () => void,
    onResetFn?: () => void
  ): Promise<{
    key: string;
    bucket: string;
    location: string;
    size: number | undefined;
    contentType: string | undefined;
  }> {
    const { log } = out("downloadFromCommonwellIntoS3.v2");

    let writeStream: stream.Writable;
    let downloadIntoS3: Promise<PutObjectCommandOutput>;

    const self = this; // eslint-disable-line @typescript-eslint/no-this-alias
    function setOrResetStream() {
      return self.getUploadStreamToS3(
        destinationFileInfo.name,
        destinationFileInfo.location,
        sourceDocument.mimeType
      );
    }
    const resp = setOrResetStream();
    writeStream = resp.writeStream;
    downloadIntoS3 = resp.promise;

    function attachListeners() {
      if (onDataFn) writeStream.on("data", onDataFn);
      if (onEndFn) writeStream.on("finish", onEndFn);
    }
    attachListeners();

    await this.downloadDocumentFromCW({
      location: sourceDocument.location,
      getStream: () => writeStream,
      resetStream: () => {
        // Prevent unhandled rejection from the previous upload promise
        // when the stream was destroyed due to a retry.
        if (downloadIntoS3 && typeof downloadIntoS3.catch === "function") {
          downloadIntoS3.catch(() => emptyFunction);
        }
        if (writeStream && !writeStream.destroyed) {
          try {
            writeStream.removeAllListeners();
            writeStream.destroy();
          } catch (error) {
            log(`Failed to cleanup old stream: ${errorToString(error)}`);
          }
        }
        if (onResetFn) onResetFn();
        const resp = setOrResetStream();
        writeStream = resp.writeStream;
        downloadIntoS3 = resp.promise;
        attachListeners();
      },
    });

    await downloadIntoS3;

    const key = destinationFileInfo.name;
    const bucket = destinationFileInfo.location;

    const location = this.s3Utils.getLocation({ key, bucket });
    log(`Uploaded ${sourceDocument.id}, ${sourceDocument.mimeType}, to ${location}`);

    const { size, contentType } = await this.s3Utils.getFileInfoFromS3(key, bucket);

    return { key, bucket, location, size, contentType };
  }

  private getNewFileName(fileName: string, newExtension: string) {
    const actualExtension = newExtension.includes(".") ? newExtension : `.${newExtension}`;
    if (!fileName.includes(".")) {
      return fileName + actualExtension;
    }
    const fileNameParts = fileName.split(".");
    fileNameParts.pop();
    return fileNameParts.join(".") + actualExtension;
  }

  protected getUploadStreamToS3(s3FileName: string, s3FileLocation: string, contentType?: string) {
    const pass = new stream.PassThrough();
    const command = new PutObjectCommand({
      Bucket: s3FileLocation,
      Key: s3FileName,
      Body: pass,
      ContentType: contentType ? contentType : "text/xml",
    });
    return {
      writeStream: pass,
      promise: this.s3Utils.s3Client.send(command),
    };
  }

  protected async downloadDocumentFromCW({
    location,
    getStream,
    resetStream,
  }: {
    location: string;
    getStream: () => stream.Writable;
    resetStream: () => void;
  }): Promise<void> {
    try {
      await executeWithNetworkRetries(
        () => {
          return this.cwApi.retrieveDocument(location, getStream());
        },
        {
          retryOnTimeout: true,
          maxAttempts: 5,
          initialDelay: 500,
          onError: () => resetStream(),
        }
      );
    } catch (error) {
      const { code, status } = getNetworkErrorDetails(error);
      const additionalInfo = {
        cwReferenceHeader: this.cwApi.lastTransactionId,
        documentLocation: location,
        code,
        status,
      };
      if (error instanceof CommonwellError && error.cause?.response?.status === 404) {
        const msg = "CW - Document not found";
        const { log } = out("downloadDocumentFromCW.v2");
        log(`${msg} - ${JSON.stringify(additionalInfo)}`);
        throw new NotFoundError(msg, error, additionalInfo);
      }
      throw new MetriportError(`CW - Error downloading document`, error, additionalInfo);
    }
  }
}

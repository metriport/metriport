import { CommonWellAPI, CommonwellError } from "@metriport/commonwell-sdk";
import {
  errorToString,
  executeWithNetworkRetries,
  getNetworkErrorDetails,
  MetriportError,
  NotFoundError,
} from "@metriport/shared";
import AWS from "aws-sdk";
import path from "path";
import * as stream from "stream";
import { DOMParser } from "xmldom";
import { detectFileType, isContentTypeAccepted } from "../../../util/file-type";
import { out } from "../../../util/log";
import { isMimeTypeXML } from "../../../util/mime";
import { makeS3Client, S3Utils } from "../../aws/s3";
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
  readonly s3client: AWS.S3;
  readonly s3Utils: S3Utils;
  readonly cwApi: CommonWellAPI;

  constructor(config: DocumentDownloaderLocalConfig) {
    super(config);
    this.s3client = makeS3Client(config.region);
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
    const downloadedDocumentInitialValue = "";
    let downloadedDocument = downloadedDocumentInitialValue;
    //eslint-disable-next-line @typescript-eslint/no-explicit-any
    function onData(chunk: any) {
      downloadedDocument += chunk;
    }
    function onEnd() {
      log("Finished downloading document");
    }
    function onReset() {
      downloadedDocument = downloadedDocumentInitialValue;
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
      downloadedDocument,
      downloadResult,
    });

    const newlyDownloadedFile: DownloadResult = {
      bucket: downloadResult.bucket,
      key: downloadResult.key,
      location: downloadResult.location,
      size: downloadResult.size,
      contentType: downloadResult.contentType,
    };

    if (downloadedDocument && isMimeTypeXML(downloadResult.contentType)) {
      return this.parseXmlFile({
        ...newlyDownloadedFile,
        contents: downloadedDocument,
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
    downloadedDocument,
    downloadResult,
  }: {
    sourceDocument: Document;
    destinationFileInfo: FileInfo;
    downloadedDocument: string;
    downloadResult: DownloadResult;
  }): Promise<DownloadResult> {
    const { log } = out("checkAndUpdateMimeType.v2");
    if (isContentTypeAccepted(sourceDocument.mimeType)) {
      return { ...downloadResult };
    }

    const old_extension = path.extname(destinationFileInfo.name);
    const { mimeType, fileExtension } = detectFileType(downloadedDocument);

    // If the file type has not changed
    if (mimeType === sourceDocument.mimeType || old_extension === fileExtension) {
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

    const b64Upload = await this.s3client
      .upload({
        Bucket: this.config.bucketName,
        Key: newFileName,
        Body: b64Buff,
        ContentType: mimeType,
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
    let downloadIntoS3: Promise<AWS.S3.ManagedUpload.SendData>;

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

    const uploadResult = await downloadIntoS3;

    log(`Uploaded ${sourceDocument.id}, ${sourceDocument.mimeType}, to ${uploadResult.Location}`);

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
    return {
      writeStream: pass,
      promise: this.s3client
        .upload({
          Bucket: s3FileLocation,
          Key: s3FileName,
          Body: pass,
          // TODO #1258
          ContentType: contentType ? contentType : "text/xml",
        })
        .promise(),
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

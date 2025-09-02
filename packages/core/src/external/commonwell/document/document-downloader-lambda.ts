import * as AWS from "aws-sdk";
import { getLambdaResultPayload, makeLambdaClient } from "../../aws/lambda";
import {
  Document,
  DocumentDownloader,
  DocumentDownloaderConfig,
  DownloadResult,
  FileInfo,
} from "./document-downloader";

export type DocumentDownloaderLambdaConfig = DocumentDownloaderConfig & {
  lambdaName: string;
} & Pick<DocumentDownloaderLambdaRequest, "orgName" | "orgOid" | "npi">;

// TODO ENG-923 remove the one w/ document/fileInfo and keep the one w/ sourceDocument/destinationFileInfo
export type DocumentDownloaderLambdaRequestV1 = {
  orgName: string;
  orgOid: string;
  npi: string;
  document: Document;
  fileInfo: FileInfo;
  cxId: string;
};
export type DocumentDownloaderLambdaRequest = {
  orgName: string;
  orgOid: string;
  npi: string;
  sourceDocument: Document;
  destinationFileInfo: FileInfo;
  cxId: string;
  version?: never;
};

export class DocumentDownloaderLambda extends DocumentDownloader {
  readonly lambdaClient: AWS.Lambda;
  readonly lambdaName: string;
  readonly orgName: string;
  readonly orgOid: string;
  readonly npi: string;

  constructor(config: DocumentDownloaderLambdaConfig) {
    super(config);
    this.lambdaName = config.lambdaName;
    this.lambdaClient = makeLambdaClient(config.region);
    this.orgName = config.orgName;
    this.orgOid = config.orgOid;
    this.npi = config.npi;
  }

  async download({
    sourceDocument,
    destinationFileInfo,
    cxId,
  }: {
    sourceDocument: Document;
    destinationFileInfo: FileInfo;
    cxId: string;
  }): Promise<DownloadResult> {
    const payload: DocumentDownloaderLambdaRequest = {
      sourceDocument,
      destinationFileInfo,
      cxId,
      orgName: this.orgName,
      orgOid: this.orgOid,
      npi: this.npi,
    };

    const lambdaResult = await this.lambdaClient
      .invoke({
        FunctionName: this.lambdaName,
        InvocationType: "RequestResponse",
        Payload: JSON.stringify(payload),
      })
      .promise();

    const resultPayload = getLambdaResultPayload({
      result: lambdaResult,
      lambdaName: this.lambdaName,
    });

    console.log(
      `Response from the downloader lambda: ${lambdaResult.StatusCode} / ${resultPayload}`
    );
    return JSON.parse(resultPayload.toString());
  }
}

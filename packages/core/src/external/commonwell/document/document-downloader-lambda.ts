import { MetriportError } from "../../../util/error/metriport-error";
import { makeLambdaClient } from "../../aws/lambda";
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

export type DocumentDownloaderLambdaRequest = {
  orgName: string;
  orgOid: string;
  npi: string;
  document: Document;
  fileInfo: FileInfo;
  cxId: string;
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
    document,
    fileInfo,
    cxId,
  }: {
    document: Document;
    fileInfo: FileInfo;
    cxId: string;
  }): Promise<DownloadResult> {
    const payload: DocumentDownloaderLambdaRequest = {
      document,
      fileInfo,
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

    if (lambdaResult.StatusCode !== 200) {
      throw new MetriportError("Lambda invocation failed", undefined, {
        lambdaName: this.lambdaName,
        docId: document.id,
      });
    }

    if (lambdaResult.Payload === undefined) {
      throw new MetriportError("Payload is undefined", undefined, {
        lambdaName: this.lambdaName,
        docId: document.id,
      });
    }

    console.log(
      `Response from the downloader lambda: ${lambdaResult.StatusCode} / ${lambdaResult.Payload}`
    );
    return JSON.parse(lambdaResult.Payload.toString());
  }
}

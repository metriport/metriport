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

export type DocumentDownloaderLambdaRequest = {
  orgName: string;
  orgOid: string;
  npi: string;
  document: Document;
  fileInfo: FileInfo;
  cxId: string;
  patientId: string;
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
    patientId,
  }: {
    document: Document;
    fileInfo: FileInfo;
    cxId: string;
    patientId: string;
  }): Promise<DownloadResult> {
    const payload: DocumentDownloaderLambdaRequest = {
      document,
      fileInfo,
      cxId,
      orgName: this.orgName,
      orgOid: this.orgOid,
      npi: this.npi,
      patientId: patientId,
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

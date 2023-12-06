import { getEnvVarOrFail } from "../../../../util/env-var";
import { MetriportError } from "../../../../util/error/metriport-error";
import { Document, DownloadResult, FileInfo } from "../document-downloader";
import { DocumentDownloaderLambda } from "../document-downloader-lambda";

class DocumentDownloaderLambdaForTest extends DocumentDownloaderLambda {
  override download({
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
    return super.download({ document, fileInfo, cxId, patientId });
  }
}

// TO BE RUN LOCALLY NOT IN CI/CD
describe.skip("document-downloader", () => {
  const region = getEnvVarOrFail("AWS_REGION");
  const bucketName = getEnvVarOrFail("MEDICAL_DOCUMENTS_BUCKET_NAME");
  const lambdaName = getEnvVarOrFail("LAMBDA_NAME");
  const orgName = getEnvVarOrFail("ORG_NAME");
  const orgOid = getEnvVarOrFail("ORG_OID");
  const orgNpi = getEnvVarOrFail("ORG_NPI");

  const cxId = getEnvVarOrFail("CX_ID");

  const docRef = {
    fileName: "xxx",
    fileLocation: "yyy",
    mimeType: "zzz",
    size: 123,
  };

  const docDownloader = new DocumentDownloaderLambdaForTest({
    region,
    bucketName,
    lambdaName,
    orgName,
    orgOid,
    npi: orgNpi,
  });

  it("lambda invocation with invalid inputs should throw an error on document download", async () => {
    const document: Document = {
      id: "1234567890",
      mimeType: docRef.mimeType,
      location: `${docRef.fileLocation}`,
    };

    await expect(
      docDownloader.download({
        document,
        fileInfo: {
          name: docRef.fileName,
          location: bucketName,
        },
        cxId,
        patientId: "1234567890",
      })
    ).rejects.toThrowError(new MetriportError(`Error calling lambda ${lambdaName}`));
  });
});

import { APIMode, CommonWell, organizationQueryMeta } from "@metriport/commonwell-sdk";
import * as stream from "stream";
import { addOidPrefix } from "../../../../domain/oid";
import { getEnvVarOrFail } from "../../../../util/env-var";
import { S3Utils } from "../../../aws/s3";
import { DocumentDownloaderLocal } from "../document-downloader-local";

class DocumentDownloaderForTest extends DocumentDownloaderLocal {
  override getUploadStreamToS3(s3FileName: string, s3FileLocation: string, contentType?: string) {
    return super.getUploadStreamToS3(s3FileName, s3FileLocation, contentType);
  }
  override downloadDocumentFromCW(params: { location: string; stream: stream.Writable }) {
    return super.downloadDocumentFromCW(params);
  }
}

// TO BE RUN LOCALLY NOT IN CI/CD
describe.skip("document-downloader", () => {
  const cwOrgCertificate = getEnvVarOrFail("CW_ORG_CERTIFICATE");
  const cwOrgPrivateKey = getEnvVarOrFail("CW_ORG_PRIVATE_KEY");
  const bucketName = getEnvVarOrFail("MEDICAL_DOCUMENTS_BUCKET_NAME");

  const region = getEnvVarOrFail("AWS_REGION");
  const fileName = getEnvVarOrFail("FILE_NAME");
  const fileLocation = getEnvVarOrFail("FILE_LOCATION");
  const mimeType = getEnvVarOrFail("MIME_TYPE");
  const fileSize = getEnvVarOrFail("FILE_SIZE");
  const size = fileSize ? parseInt(fileSize) : undefined;
  const orgName = getEnvVarOrFail("ORG_NAME");
  const orgOid = getEnvVarOrFail("ORG_OID");
  const orgNpi = getEnvVarOrFail("ORG_NPI");

  const docRef = {
    fileName,
    fileLocation,
    mimeType,
    size,
  };

  const org = {
    name: orgName,
    oid: orgOid,
    npi: orgNpi,
  };

  const commonWell =
    cwOrgCertificate && cwOrgPrivateKey
      ? new CommonWell(
          cwOrgCertificate,
          cwOrgPrivateKey,
          org.name,
          addOidPrefix(org.oid),
          APIMode.integration
        )
      : undefined;
  const queryMeta = organizationQueryMeta(org.name, { npi: org.npi });
  const s3Utils = new S3Utils(region);

  const docDownloader =
    bucketName && commonWell
      ? new DocumentDownloaderForTest({
          region,
          bucketName,
          commonWell: {
            api: commonWell,
            queryMeta,
          },
        })
      : undefined;

  it("should download the document from cw and store in s3", async () => {
    if (!docDownloader) throw new Error("docDownloader is undefined");
    if (!commonWell) throw new Error("commonWell is undefined");
    if (!bucketName) throw new Error("bucketName is undefined");

    const { writeStream, promise } = docDownloader.getUploadStreamToS3(
      docRef.fileName,
      bucketName,
      docRef.mimeType
    );

    await docDownloader.downloadDocumentFromCW({
      location: docRef.fileLocation,
      stream: writeStream,
    });

    const uploadResult = await promise;

    expect(uploadResult).toBeTruthy();
    expect(uploadResult.Key).toEqual(docRef.fileName);

    const { size, contentType } = await s3Utils.getFileInfoFromS3(
      uploadResult.Key,
      uploadResult.Bucket
    );

    expect(size).toEqual(docRef.size);
    expect(contentType).toEqual(docRef.mimeType);
  });
});

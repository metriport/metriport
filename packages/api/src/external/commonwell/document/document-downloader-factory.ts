import { organizationQueryMeta } from "@metriport/commonwell-sdk";
import { DocumentDownloader } from "@metriport/core/external/commonwell/document/document-downloader";
import { DocumentDownloaderLambda } from "@metriport/core/external/commonwell/document/document-downloader-lambda";
import { DocumentDownloaderLocal } from "@metriport/core/external/commonwell/document/document-downloader-local";
import { oid } from "@metriport/core/domain/oid";
import { Config } from "../../../shared/config";
import { makeCommonWellAPI } from "../api";

export function makeDocumentDownloader({
  orgName,
  orgOid,
  npi,
}: {
  orgName: string;
  orgOid: string;
  npi: string;
}): DocumentDownloader {
  const region = Config.getAWSRegion();
  const bucketName = Config.getMedicalDocumentsBucketName();
  if (Config.isDev()) {
    const commonWell = makeCommonWellAPI(orgName, oid(orgOid));
    const queryMeta = organizationQueryMeta(orgName, { npi });
    return new DocumentDownloaderLocal({
      region,
      bucketName,
      commonWell: {
        api: commonWell,
        queryMeta,
      },
    });
  }
  return new DocumentDownloaderLambda({
    region,
    bucketName,
    lambdaName: Config.getDocumentDownloaderLambdaName(),
    orgName,
    orgOid,
    npi,
  });
}

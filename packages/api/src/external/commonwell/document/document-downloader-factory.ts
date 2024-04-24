import { organizationQueryMeta } from "@metriport/commonwell-sdk";
import { addOidPrefix } from "@metriport/core/domain/oid";
import { DocumentDownloader } from "@metriport/core/external/commonwell/document/document-downloader";
import { DocumentDownloaderLambda } from "@metriport/core/external/commonwell/document/document-downloader-lambda";
import { DocumentDownloaderLocal } from "@metriport/core/external/commonwell/document/document-downloader-local";
import { HieInitiator } from "../../../command/medical/hie/get-hie-initiator";
import { Config } from "../../../shared/config";
import { makeCommonWellAPI } from "../api";

export function makeDocumentDownloader({ name, oid, npi }: HieInitiator): DocumentDownloader {
  const region = Config.getAWSRegion();
  const bucketName = Config.getMedicalDocumentsBucketName();
  if (Config.isDev()) {
    const commonWell = makeCommonWellAPI(name, addOidPrefix(oid));
    const queryMeta = organizationQueryMeta(name, { npi });
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
    orgName: name,
    orgOid: oid,
    npi,
  });
}

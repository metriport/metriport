import { addOidPrefix } from "@metriport/core/domain/oid";
import { DocumentDownloader } from "@metriport/core/external/commonwell/document/document-downloader";
import { DocumentDownloaderLambda } from "@metriport/core/external/commonwell/document/document-downloader-lambda";
import { DocumentDownloaderLocalV2 } from "@metriport/core/external/commonwell-v2/document/document-downloader-local-v2";
import { Config } from "../../../shared/config";
import { HieInitiator } from "../../hie/get-hie-initiator";
import { makeCommonWellAPI } from "../api";

export function makeDocumentDownloader({ name, oid, npi }: HieInitiator): DocumentDownloader {
  const region = Config.getAWSRegion();
  const bucketName = Config.getMedicalDocumentsBucketName();
  if (Config.isDev()) {
    const commonWell = makeCommonWellAPI(name, addOidPrefix(oid), npi);
    return new DocumentDownloaderLocalV2({
      region,
      bucketName,
      commonWell: {
        api: commonWell,
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

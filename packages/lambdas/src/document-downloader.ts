import { getSecret } from "@aws-lambda-powertools/parameters/secrets";
import { APIMode, CommonWell } from "@metriport/commonwell-sdk";
import { FeatureFlags } from "@metriport/core/command/feature-flags/ffs-on-dynamodb";
import { DocumentDownloaderLocalV2 } from "@metriport/core/external/commonwell-v2/document/document-downloader-local-v2";
import {
  Document,
  DownloadResult,
  FileInfo,
} from "@metriport/core/external/commonwell/document/document-downloader";
import {
  DocumentDownloaderLambdaRequest,
  DocumentDownloaderLambdaRequestV1,
} from "@metriport/core/external/commonwell/document/document-downloader-lambda";
import { getEnvType } from "@metriport/core/util/env-var";
import dayjs from "dayjs";
import duration from "dayjs/plugin/duration";
import { capture } from "./shared/capture";
import { getEnv, getEnvOrFail, isProduction } from "./shared/env";

// Keep this as early on the file as possible
capture.init();

dayjs.extend(duration);

const timeout = dayjs.duration({ minutes: 4 });

// Automatically set by AWS
const lambdaName = getEnv("AWS_LAMBDA_FUNCTION_NAME");
const region = getEnvOrFail("AWS_REGION");
// Set by us
const bucketName = getEnvOrFail("MEDICAL_DOCUMENTS_BUCKET_NAME");
const cwOrgCertificateSecret = getEnvOrFail("CW_ORG_CERTIFICATE");
const cwOrgPrivateKeySecret = getEnvOrFail("CW_ORG_PRIVATE_KEY");
const featureFlagsTableName = getEnvOrFail("FEATURE_FLAGS_TABLE_NAME");

const apiMode = isProduction() ? APIMode.production : APIMode.integration;

FeatureFlags.init(region, featureFlagsTableName);

export const handler = capture.wrapHandler(
  async (
    req: DocumentDownloaderLambdaRequest | DocumentDownloaderLambdaRequestV1
  ): Promise<DownloadResult> => {
    // TODO ENG-923 revert to the full deconstruction and remove the 'if' statement
    const { orgName, orgOid, npi, cxId, queryGrantorOid } = req;
    // const { orgName, orgOid, npi, cxId, sourceDocument, destinationFileInfo } = req;
    let sourceDocument: Document;
    let destinationFileInfo: FileInfo;
    if ("document" in req) {
      const { document, fileInfo } = req;
      sourceDocument = document;
      destinationFileInfo = fileInfo;
    } else {
      const { sourceDocument: document, destinationFileInfo: fileInfo } = req;
      sourceDocument = document;
      destinationFileInfo = fileInfo;
    }
    capture.setUser({ id: cxId });
    capture.setExtra({ lambdaName, cxId, orgOid });
    console.log(
      `Running with envType: ${getEnvType()}, apiMode: ${apiMode}, region: ${region}, ` +
        `bucketName: ${bucketName}, orgName: ${orgName}, orgOid: ${orgOid}, ` +
        `npi: ${npi}, cxId: ${cxId}, destinationFileInfo: ${JSON.stringify(
          destinationFileInfo
        )}, ` +
        `sourceDocument: ${JSON.stringify(sourceDocument)} ${
          queryGrantorOid ? `, queryGrantorOid: ${queryGrantorOid}` : ""
        }`
    );

    const [cwOrgCertificate, cwOrgPrivateKey] = await Promise.all([
      getSecret(cwOrgCertificateSecret) as Promise<string>,
      getSecret(cwOrgPrivateKeySecret) as Promise<string>,
    ]);

    if (!cwOrgCertificate) {
      throw new Error(`Config error - CW_ORG_CERTIFICATE doesn't exist`);
    }
    if (!cwOrgPrivateKey) {
      throw new Error(`Config error - CW_ORG_PRIVATE_KEY doesn't exist`);
    }

    const commonWell = new CommonWell({
      orgCert: cwOrgCertificate,
      rsaPrivateKey: cwOrgPrivateKey,
      orgName,
      oid: orgOid,
      homeCommunityId: orgOid,
      npi,
      apiMode,
      queryGrantorOid,
      options: { timeout: timeout.asMilliseconds() },
    });

    const docDownloader = new DocumentDownloaderLocalV2({
      region,
      bucketName,
      commonWell: { api: commonWell },
      capture,
    });
    const result = await docDownloader.download({
      cxId,
      sourceDocument,
      destinationFileInfo,
    });

    console.log(`Done - ${JSON.stringify(result)}`);
    return result;
  }
);

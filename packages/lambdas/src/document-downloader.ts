import { getSecret } from "@aws-lambda-powertools/parameters/secrets";
import {
  APIMode,
  CommonWell,
  CommonWellAPI,
  organizationQueryMeta,
} from "@metriport/commonwell-sdk";
import { addOidPrefix } from "@metriport/core/domain/oid";
import { DownloadResult } from "@metriport/core/external/commonwell/document/document-downloader";
import { DocumentDownloaderLambdaRequest } from "@metriport/core/external/commonwell/document/document-downloader-lambda";
import { DocumentDownloaderLocal } from "@metriport/core/external/commonwell/document/document-downloader-local";
import { getEnvType } from "@metriport/core/util/env-var";
import * as Sentry from "@sentry/serverless";
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

const apiMode = isProduction() ? APIMode.production : APIMode.integration;

export const handler = Sentry.AWSLambda.wrapHandler(
  async (req: DocumentDownloaderLambdaRequest): Promise<DownloadResult> => {
    // TODO 1706 Rename orgName, orgOid, and npi to Initiator
    // TODO 1706 Rename orgName, orgOid, and npi to Initiator
    // TODO 1706 Rename orgName, orgOid, and npi to Initiator
    const { orgName, orgOid, npi, cxId, fileInfo, document } = req;
    capture.setUser({ id: cxId });
    capture.setExtra({ lambdaName });
    console.log(
      `Running with envType: ${getEnvType()}, apiMode: ${apiMode}, region: ${region}, ` +
        `bucketName: ${bucketName}, orgName: ${orgName}, orgOid: ${orgOid}, ` +
        `npi: ${npi}, cxId: ${cxId}, fileInfo: ${JSON.stringify(fileInfo)}, ` +
        `document: ${JSON.stringify(document)}`
    );

    const cwOrgCertificate: string = (await getSecret(cwOrgCertificateSecret)) as string;
    if (!cwOrgCertificate) {
      throw new Error(`Config error - CW_ORG_CERTIFICATE doesn't exist`);
    }

    const cwOrgPrivateKey: string = (await getSecret(cwOrgPrivateKeySecret)) as string;
    if (!cwOrgPrivateKey) {
      throw new Error(`Config error - CW_ORG_PRIVATE_KEY doesn't exist`);
    }

    const commonWell = makeCommonWellAPI(
      cwOrgCertificate,
      cwOrgPrivateKey,
      orgName,
      addOidPrefix(orgOid)
    );
    const queryMeta = organizationQueryMeta(orgName, { npi: npi });

    const docDownloader = new DocumentDownloaderLocal({
      region,
      bucketName,
      commonWell: {
        api: commonWell,
        queryMeta,
      },
      capture,
    });
    const result = await docDownloader.download({ document, fileInfo });

    console.log(`Done - ${JSON.stringify(result)}`);
    return result;
  }
);

export function makeCommonWellAPI(
  cwOrgCertificate: string,
  cwOrgKey: string,
  orgName: string,
  orgOID: string
): CommonWellAPI {
  return new CommonWell(cwOrgCertificate, cwOrgKey, orgName, orgOID, apiMode, {
    timeout: timeout.asMilliseconds(),
  });
}

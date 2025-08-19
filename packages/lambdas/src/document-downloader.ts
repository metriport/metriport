import { getSecret } from "@aws-lambda-powertools/parameters/secrets";
import { APIMode, CommonWell } from "@metriport/commonwell-sdk";
import {
  CommonWell as CommonWellV1,
  CommonWellAPI as CommonWellAPIV1,
  organizationQueryMeta,
} from "@metriport/commonwell-sdk-v1";
import { isCommonwellV2EnabledForCx } from "@metriport/core/command/feature-flags/domain-ffs";
import { addOidPrefix } from "@metriport/core/domain/oid";
import { DocumentDownloaderLocal } from "@metriport/core/external/commonwell-v1/document/document-downloader-local";
import { DocumentDownloaderLocalV2 } from "@metriport/core/external/commonwell-v2/document/document-downloader-local-v2";
import { DownloadResult } from "@metriport/core/external/commonwell/document/document-downloader";
import { DocumentDownloaderLambdaRequest } from "@metriport/core/external/commonwell/document/document-downloader-lambda";
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

const apiMode = isProduction() ? APIMode.production : APIMode.integration;

export const handler = capture.wrapHandler(
  async (req: DocumentDownloaderLambdaRequest): Promise<DownloadResult> => {
    const { orgName, orgOid, npi, cxId, fileInfo, document } = req;
    capture.setUser({ id: cxId });
    capture.setExtra({ lambdaName, cxId, orgOid });
    console.log(
      `Running with envType: ${getEnvType()}, apiMode: ${apiMode}, region: ${region}, ` +
        `bucketName: ${bucketName}, orgName: ${orgName}, orgOid: ${orgOid}, ` +
        `npi: ${npi}, cxId: ${cxId}, fileInfo: ${JSON.stringify(fileInfo)}, ` +
        `document: ${JSON.stringify(document)}`
    );

    const [cwOrgCertificate, cwOrgPrivateKey, isV2Enabled] = await Promise.all([
      getSecret(cwOrgCertificateSecret) as Promise<string>,
      getSecret(cwOrgPrivateKeySecret) as Promise<string>,
      isCommonwellV2EnabledForCx(cxId),
    ]);

    if (!cwOrgCertificate) {
      throw new Error(`Config error - CW_ORG_CERTIFICATE doesn't exist`);
    }
    if (!cwOrgPrivateKey) {
      throw new Error(`Config error - CW_ORG_PRIVATE_KEY doesn't exist`);
    }

    // TODO ENG-513 remove this once we're migrated over to v2
    if (!isV2Enabled) {
      // V1
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

    // V2
    const commonWell = new CommonWell({
      orgCert: cwOrgCertificateSecret,
      rsaPrivateKey: cwOrgPrivateKeySecret,
      orgName,
      oid: orgOid,
      homeCommunityId: orgOid,
      npi,
      apiMode,
    });

    const docDownloader = new DocumentDownloaderLocalV2({
      region,
      bucketName,
      commonWell: { api: commonWell },
      capture,
    });
    const result = await docDownloader.download({ document, fileInfo });

    console.log(`Done - ${JSON.stringify(result)}`);
    return result;
  }
);

function makeCommonWellAPI(
  cwOrgCertificate: string,
  cwOrgKey: string,
  orgName: string,
  orgOID: string
): CommonWellAPIV1 {
  return new CommonWellV1(cwOrgCertificate, cwOrgKey, orgName, orgOID, apiMode, {
    timeout: timeout.asMilliseconds(),
  });
}

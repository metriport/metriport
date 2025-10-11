import { errorToString } from "@metriport/shared";
import { Config } from "../../util/config";
import { out } from "../../util/log";
import { JSON_APP_MIME_TYPE } from "../../util/mime";
import { capture } from "../../util/notifications";
import { S3Utils } from "../aws/s3";

const region = Config.getAWSRegion();
const s3Utils = new S3Utils(region);
const PRINCIPAL_AND_DELEGATES_FILE_NAME = "principal-and-delegates.json";

/**
 * TODO: Move to a shared location, accept source to be part of the name
 */
export async function safelyUploadPrincipalAndDelegatesToS3(
  principalAndDelegatesMap: Map<string, string[]>,
  source: "cq" | "cw"
): Promise<void> {
  const { log } = out(`safelyUploadPrincipalAndDelegatesToS3`);
  const bucket = Config.getGeneralBucketName();
  const key = buildPrincipalAndDelegatesMapKey(source);
  try {
    await s3Utils.uploadFile({
      bucket,
      key,
      file: Buffer.from(JSON.stringify(Object.fromEntries(principalAndDelegatesMap))),
      contentType: JSON_APP_MIME_TYPE,
    });
    log(`Principal and Delegates map uploaded successfully to ${bucket}/${key}`);
  } catch (error) {
    const msg = `Error uploading Principal and Delegates map`;
    log(`${msg}: error - ${errorToString(error)}`);
    capture.error(msg, { extra: { error, context: "safelyUploadPrincipalAndDelegatesToS3" } });
  }
}

export async function getPrincipalAndDelegatesMap(
  source: "cq" | "cw"
): Promise<Map<string, string[]>> {
  const { log } = out(`getPrincipalAndDelegatesMap`);
  const bucket = Config.getGeneralBucketName();

  try {
    const file = await s3Utils.downloadFile({
      bucket,
      key: buildPrincipalAndDelegatesMapKey(source),
    });
    return new Map(Object.entries(JSON.parse(file.toString())));
  } catch (error) {
    const msg = `Error downloading Principal and Delegates map`;
    log(`${msg}: error - ${errorToString(error)}`);
    capture.error(msg, { extra: { error, context: "getPrincipalAndDelegatesMap" } });
    throw error;
  }
}

function buildPrincipalAndDelegatesMapKey(source: "cq" | "cw"): string {
  return `${source}-${PRINCIPAL_AND_DELEGATES_FILE_NAME}`;
}

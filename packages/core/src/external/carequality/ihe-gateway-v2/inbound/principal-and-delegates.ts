import { errorToString } from "@metriport/shared";
import { Config } from "../../../../util/config";
import { out } from "../../../../util/log";
import { JSON_APP_MIME_TYPE } from "../../../../util/mime";
import { capture } from "../../../../util/notifications";
import { S3Utils } from "../../../aws/s3";
import { PRINCIPAL_AND_DELEGATES_FILE_NAME } from "../../shared";

const region = Config.getAWSRegion();
const s3Utils = new S3Utils(region);

export async function uploadPrincipalAndDelegatesToS3(
  principalAndDelegatesMap: Map<string, string[]>
): Promise<void> {
  const { log } = out(`uploadPrincipalAndDelegatesToS3`);
  const bucket = Config.getGeneralBucketName();
  try {
    await s3Utils.uploadFile({
      bucket,
      key: PRINCIPAL_AND_DELEGATES_FILE_NAME,
      file: Buffer.from(JSON.stringify(Object.fromEntries(principalAndDelegatesMap))),
      contentType: JSON_APP_MIME_TYPE,
    });
    log(
      `Principal and Delegates map uploaded successfully to ${bucket}/${PRINCIPAL_AND_DELEGATES_FILE_NAME}`
    );
  } catch (error) {
    const msg = `Error uploading Principal and Delegates map`;
    log(`${msg}: error - ${errorToString(error)}`);
    capture.error(msg, { extra: { error, context: "uploadPrincipalAndDelegatesToS3" } });
  }
}

export async function getPrincipalAndDelegatesMap(): Promise<Map<string, string[]>> {
  const { log } = out(`getPrincipalAndDelegatesMap`);
  const bucket = Config.getGeneralBucketName();

  try {
    const file = await s3Utils.downloadFile({
      bucket,
      key: PRINCIPAL_AND_DELEGATES_FILE_NAME,
    });
    return new Map(Object.entries(JSON.parse(file.toString())));
  } catch (error) {
    const msg = `Error downloading Principal and Delegates map`;
    log(`${msg}: error - ${errorToString(error)}`);
    capture.error(msg, { extra: { error, context: "getPrincipalAndDelegatesMap" } });
    throw error;
  }
}

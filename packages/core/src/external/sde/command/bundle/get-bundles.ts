import _ from "lodash";
import { S3Utils } from "../../../aws/s3";
import { Config } from "../../../../util/config";
import { Bundle } from "@medplum/fhirtypes";
import { DataExtractionFile } from "../../types";
import { getDataExtractionFilePrefix } from "../../file-names";
import { out } from "../../../../util/log";

export async function getBundles({
  cxId,
  patientId,
}: {
  cxId: string;
  patientId: string;
}): Promise<Bundle[]> {
  const { log } = out("sde.getBundles");
  const prefix = getDataExtractionFilePrefix({ cxId, patientId });

  const s3Utils = new S3Utils(Config.getAWSRegion());
  const bucketName = Config.getStructuredDataBucketName();
  if (!bucketName) {
    log(`No structured data bucket name found, skipping`);
    return [];
  }
  const files = await s3Utils.listObjects(bucketName, prefix);
  const keys = _(files.map(file => file.Key))
    .compact()
    .value();
  const bundleContents = await Promise.all(
    keys.map(key => s3Utils.downloadFile({ bucket: bucketName, key }))
  );
  const dataExtractionFiles: DataExtractionFile[] = bundleContents.map(
    bundle => JSON.parse(bundle.toString()) as DataExtractionFile
  );
  const bundles = dataExtractionFiles.map(file => file.bundle);
  return bundles;
}

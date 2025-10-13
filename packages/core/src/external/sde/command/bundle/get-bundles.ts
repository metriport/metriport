import _ from "lodash";
import { S3Utils } from "../../../aws/s3";
import { Config } from "../../../../util/config";
import { Bundle, BundleEntry } from "@medplum/fhirtypes";
import { DataExtractionFile } from "../../types";
import { getDataExtractionFilePrefix } from "../../file-names";
import { executeAsynchronously } from "../../../../util/concurrency";
import { out } from "../../../../util/log";

const numberOfParallelExecutions = 10;

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

  const bundleBuffers: Buffer[] = [];
  await executeAsynchronously(
    keys,
    async key => {
      const buffer = await s3Utils.downloadFile({ bucket: bucketName, key });
      bundleBuffers.push(buffer);
    },
    {
      numberOfParallelExecutions,
    }
  );
  const dataExtractionFiles: DataExtractionFile[] = bundleBuffers.map(
    buffer => JSON.parse(buffer.toString()) as DataExtractionFile
  );
  const bundles = dataExtractionFiles.map(file => file.bundle);
  return bundles;
}

export async function getBundleResources({
  cxId,
  patientId,
}: {
  cxId: string;
  patientId: string;
}): Promise<BundleEntry[]> {
  const bundles = await getBundles({ cxId, patientId });
  return bundles.flatMap(bundle => bundle.entry ?? []);
}

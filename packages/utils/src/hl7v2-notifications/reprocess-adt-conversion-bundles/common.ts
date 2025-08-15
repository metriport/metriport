/* eslint-disable no-useless-escape */
import * as dotenv from "dotenv";
dotenv.config();
// keep that ^ on top

import { S3Utils } from "@metriport/core/external/aws/s3";
import { Config } from "@metriport/core/util/config";
import { out } from "@metriport/core/util/log";
import { FhirBundleSdk } from "@metriport/fhir-sdk";
import { parseFhirBundle } from "@metriport/shared/medical/fhir/bundle";

const bucketName = Config.getHl7ConversionBucketName();

/**
 * Re-processes ADT conversion bundles stored in S3.
 *
 * @param prefixes - The prefixes of the bundles to re-process.
 * @param handler - The handler function that will be called to transform each bundle.
 */
export async function reprocessAdtConversionBundles(
  prefixes: string[],
  handler: (bundle: FhirBundleSdk, log: (message: string) => void) => Promise<FhirBundleSdk>
) {
  if (bucketName === undefined) {
    throw new Error(
      "Failed to find environment variable from `Config.getHl7ConversionBucketName()`"
    );
  }

  const s3Utils = new S3Utils(Config.getAWSRegion());
  const promises = prefixes.map(async prefix => {
    const { log } = out(prefix);
    const results = await s3Utils.listObjects(bucketName, prefix);
    log(`Found ${results.length} objects for prefix: ${prefix}`);
    let processedCount = 0;
    const fileProcessingPromises = results.map(async result => {
      log(`Processing object: ${result.Key}`);
      if (result.Key === undefined) {
        log("Key is undefined - and it shouldn't be");
        return;
      }
      const fileBuffer = await s3Utils.downloadFile({ bucket: bucketName, key: result.Key });
      const rawBuffer = fileBuffer.toString();
      const bundleObject = parseFhirBundle(rawBuffer);
      if (!bundleObject) {
        log("Bundle is undefined - and it shouldn't be");
        return;
      }

      const bundle = await FhirBundleSdk.create(bundleObject);
      const cleanedBundle = await handler(bundle, log);

      // Overwrite old bundle
      await s3Utils.uploadFile({
        bucket: bucketName,
        key: result.Key,
        file: Buffer.from(JSON.stringify(cleanedBundle.toObject())),
        contentType: "application/json",
      });
      processedCount++;
      log(`Processed ${processedCount} objects`);
    });

    await Promise.all(fileProcessingPromises);
  });

  await Promise.all(promises);
  console.log("Done");
}

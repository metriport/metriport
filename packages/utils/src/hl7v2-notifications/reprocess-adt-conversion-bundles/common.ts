/* eslint-disable no-useless-escape */
import * as dotenv from "dotenv";
dotenv.config();
// keep that ^ on top

import { S3Utils } from "@metriport/core/external/aws/s3";
import { Config } from "@metriport/core/util/config";
import { out } from "@metriport/core/util/log";
import { FhirBundleSdk } from "@metriport/fhir-sdk";
import { parseFhirBundle } from "@metriport/shared/medical/fhir/bundle";
import dayjs from "dayjs";
import duration from "dayjs/plugin/duration";
import { sleep } from "@metriport/shared/common/sleep";

dayjs.extend(duration);

const bucketName = Config.getHl7ConversionBucketName();

/**
 * Re-processes ADT conversion bundles stored in S3.
 *
 * @param prefixes - The prefixes of the bundles to re-process.
 * @param handler - The handler function that will be called to transform each bundle.
 * @param readOnly - Whether to only read the bundles from S3 and not write them back.
 */
export async function reprocessAdtConversionBundles(
  prefixes: string[],
  handler: (
    bundle: FhirBundleSdk,
    log: (message: string) => void,
    context: { cxId: string; ptId: string }
  ) => Promise<FhirBundleSdk | undefined>,
  dryRun = true
) {
  if (bucketName === undefined) {
    throw new Error(
      "Failed to find environment variable from `Config.getHl7ConversionBucketName()`"
    );
  }

  const s3Utils = new S3Utils(Config.getAWSRegion());

  if (!dryRun) {
    console.log(`⚠️ Running in write mode`);
    await displayWarningAndConfirmation(prefixes);
  } else {
    console.log(`Running in dryRun mode`);
  }

  const promises = prefixes.map(async prefix => {
    const { log } = out(prefix);
    const results = await s3Utils.listObjects(bucketName, prefix);
    const noFolderResults = results.filter(result => {
      return result.Size !== 0;
    });
    log(`Found ${noFolderResults.length} objects for prefix: ${prefix}`);
    let processedCount = 0;
    const fileProcessingPromises = noFolderResults.map(async result => {
      const [cxId, ptId] = prefix.replace("cxId=", "").replace("ptId=", "").split("/");
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
      const cleanedBundle = await handler(bundle, out(`${result.Key}`).log, { cxId, ptId });

      // Overwrite old bundle
      if (!dryRun && cleanedBundle) {
        await s3Utils.uploadFile({
          bucket: bucketName,
          key: result.Key,
          file: Buffer.from(JSON.stringify(cleanedBundle.toObject())),
          contentType: "application/json",
        });
      }
      processedCount++;
      if (processedCount % 100 === 0) {
        log(`Processed ${processedCount} objects`);
      }
    });

    await Promise.all(fileProcessingPromises);
  });

  await Promise.all(promises);
  console.log("Done");
}

const confirmationTime = dayjs.duration(10, "seconds");

async function displayWarningAndConfirmation(prefixes: string[]) {
  console.log(``);
  console.log(
    `THIS IS SUPER DESTRUCTIVE!! IT WILL MODIFY ADT CONVERSION BUNDLES IN S3! ONLY CONTINUE IF YOU KNOW WHAT YOU ARE DOING!`
  );
  console.log(``);
  console.log(
    `Modifying ALL conversion bundles in ${bucketName} for prefixes: ${prefixes.join(
      ", "
    )} in ${confirmationTime.asSeconds()} seconds...`
  );
  await sleep(confirmationTime.asMilliseconds());
  console.log(`ok, continuing...`);
  await sleep(dayjs.duration(1, "seconds").asMilliseconds());
}

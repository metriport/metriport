/* eslint-disable no-useless-escape */
import * as dotenv from "dotenv";
dotenv.config();
// keep that ^ on top
import { S3Utils } from "@metriport/core/external/aws/s3";
import { Config } from "@metriport/core/util/config";
import { FhirBundleSdk } from "@metriport/fhir-sdk";
import { parseFhirBundle } from "@metriport/shared/medical/fhir/bundle";
import _ from "lodash";
import { out } from "@metriport/core/util/log";

const bucketName = Config.getHl7ConversionBucketName();

async function reprocessAllAdtConversionBundles() {
  const s3Utils = new S3Utils(Config.getAWSRegion());

  // All existing CXs with ADT conversion bundles
  const prefixes: string[] = [];
  const promises = prefixes.map(async prefix => {
    const { log } = out(`${prefix}`);
    const results = await s3Utils.listObjects(bucketName, prefix);
    log(`Found ${results.length} objects for prefix: ${prefix}`);
    let processedCount = 0;
    results.forEach(async result => {
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
      const badConditionIds: string[] = [];

      bundle.getEncounters().forEach(e => {
        if (!e.reasonCode) {
          log("Encounter / reasonCode undefined, skipping");
          return;
        }

        const reasonCodes = _.uniqBy(e.reasonCode, "coding.code");
        // Find condition codings that are an identical match to the encounter reason codings
        const badConditions = bundle
          .getConditions()
          .filter(condition =>
            reasonCodes.some(reasonCode => _.isEqual(reasonCode, condition.code))
          );

        // Remove bad elements from diagnosis array
        const newDiagnoses = e.diagnosis?.filter(d =>
          badConditions.every(c => c.id !== d.condition?.reference?.split("/")[1])
        );
        e.diagnosis = newDiagnoses;

        badConditionIds.push(..._.compact(badConditions.map(c => c.id)));
      });

      // Remove bad condition from bundle
      const goodResourceIds = bundle.entry
        ?.filter(e => !badConditionIds.includes(e.resource?.id ?? ""))
        ?.flatMap(e => e.resource?.id ?? []);

      const goodBundle = bundle.exportSubset(goodResourceIds);

      // Overwrite old bundle
      s3Utils.uploadFile({
        bucket: bucketName,
        key: result.Key,
        file: Buffer.from(JSON.stringify(goodBundle)),
        contentType: "application/json",
      });
      processedCount++;
      log(`Processed ${processedCount} objects`);
    });
  });

  await Promise.all(promises);
  console.log("Done");
}

reprocessAllAdtConversionBundles();

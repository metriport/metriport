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
  const prefixes = [
    "cxId=15ae0cea-e90a-4a49-82e4-42164c74b0aa/",
    // "cxId=35d40878-d15e-46cd-931c-135f5a5550f2/",
    // "cxId=4e0fb48c-e2c3-46c5-8713-e4926503fcb7/",
    // "cxId=5af0e105-9439-4c02-939b-ecf7b230b418/",
    // "cxId=9bb6740e-a5bc-4c03-b1c5-77441427dd3c/"
  ];
  const promises = prefixes.map(async prefix => {
    const { log } = out(`${prefix}`);
    const results = await s3Utils.listObjects(bucketName, prefix);
    log(`Found ${results.length} objects for prefix: ${prefix}`);
    let processedCount = 0;
    const testResults = [
      {
        Key: "cxId=0b183560-ec8e-41f4-aaa4-6b467666abe5/ptId=0196ffb3-69c1-7575-9a1d-3216ded4d46a/ADT/d8bd248f-d4b4-3514-98e8-ff925ed42bb2/2025-05-07T03_43_13_716510801_A03.hl7.json",
      },
    ];
    testResults.forEach(async result => {
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

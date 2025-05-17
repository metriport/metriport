import { Bundle, Resource } from "@medplum/fhirtypes";
import { S3Utils } from "../../external/aws/s3";
import { out } from "../../util";
import { Config } from "../../util/config";
import { buildAdtLatestFileKey } from "../hl7v2-subscriptions/hl7v2-to-fhir-conversion/shared";

const s3Utils = new S3Utils(Config.getAWSRegion());
const s3BucketName = Config.getHl7ConversionBucketName();

/**
 * Retrieves the ADT-sourced encounter from S3
 * @param cxId Customer ID
 * @param patientId Patient ID
 * @param encounterId Encounter ID
 * @returns The encounter data as a parsed JSON object
 */
export async function getAdtSourcedEncounter({
  cxId,
  patientId,
  encounterId,
}: {
  cxId: string;
  patientId: string;
  encounterId: string;
}): Promise<Bundle<Resource> | undefined> {
  const { log } = out(
    `getAdtSourcedEncounter - cx: ${cxId}, pt: ${patientId}, enc: ${encounterId}`
  );

  const fileKey = buildAdtLatestFileKey({
    cxId,
    patientId,
    encounterId,
  });

  let fileData: Buffer | undefined;
  try {
    fileData = await s3Utils.downloadFile({
      bucket: s3BucketName,
      key: fileKey,
    });
  } catch (error) {
    log(`No prior ADT encounter found in S3 bucket: ${s3BucketName} at key: ${fileKey}`);
    return undefined;
  }
  log(`Found ADT encounter in S3 bucket: ${s3BucketName} at key: ${fileKey}`);

  return JSON.parse(fileData.toString());
}

export async function putAdtSourcedEncounter({
  cxId,
  patientId,
  encounterId,
  bundle,
}: {
  cxId: string;
  patientId: string;
  encounterId: string;
  bundle: Bundle<Resource>;
}): Promise<AWS.S3.ManagedUpload.SendData & { VersionId: string }> {
  const { log } = out(
    `putAdtSourcedEncounter - cx: ${cxId}, pt: ${patientId}, enc: ${encounterId}`
  );

  const fileKey = buildAdtLatestFileKey({
    cxId,
    patientId,
    encounterId,
  });

  log(`Uploading ADT encounter to S3 bucket: ${s3BucketName} at key: ${fileKey}`);
  return (await s3Utils.uploadFile({
    bucket: s3BucketName,
    key: fileKey,
    file: Buffer.from(JSON.stringify(bundle)),
  })) as AWS.S3.ManagedUpload.SendData & { VersionId: string };
}

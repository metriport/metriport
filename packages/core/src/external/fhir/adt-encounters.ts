import { Bundle, Resource } from "@medplum/fhirtypes";
import { out } from "../../util";
import { Config } from "../../util/config";
import { HL7_FILE_EXTENSION, JSON_FILE_EXTENSION } from "../../util/mime";
import { S3Utils } from "../aws/s3";

const s3Utils = new S3Utils(Config.getAWSRegion());
const s3BucketName = Config.getHl7ConversionBucketName();

export function createPrefixAdtEncounter({
  cxId,
  patientId,
  encounterId,
}: {
  cxId: string;
  patientId: string;
  encounterId: string;
}) {
  return `cxId=${cxId}/ptId=${patientId}/ADT/${encounterId}`;
}

export function createFileKeyAdtLatest({
  cxId,
  patientId,
  encounterId,
}: {
  cxId: string;
  patientId: string;
  encounterId: string;
}) {
  return `${createPrefixAdtEncounter({
    cxId,
    patientId,
    encounterId,
  })}/latest.${HL7_FILE_EXTENSION}.${JSON_FILE_EXTENSION}`;
}

export function createFileKeyAdtEncounter({
  cxId,
  patientId,
  encounterId,
  timestamp,
  messageId,
  triggerEvent,
}: {
  cxId: string;
  patientId: string;
  encounterId: string;
  timestamp: string;
  messageId: string;
  messageCode: string;
  triggerEvent: string;
}) {
  return `${createPrefixAdtEncounter({
    cxId,
    patientId,
    encounterId,
  })}/${timestamp}_${messageId}_ADT_${triggerEvent}.${HL7_FILE_EXTENSION}.${JSON_FILE_EXTENSION}`;
}

/**
 * Uploads the raw ADT conversion output to S3
 * @param cxId Customer ID
 * @param patientId Patient ID
 * @param encounterId Encounter ID
 * @param timestamp Timestamp of the message
 * @param messageId Message ID
 * @param messageCode Message code
 * @param triggerEvent Trigger event
 * @param bundle The FHIR bundle
 * @param s3Utils S3 utils
 * @returns The encounter data as a parsed JSON object
 */
export async function putAdtConversionBundle({
  cxId,
  patientId,
  encounterId,
  timestamp,
  messageId,
  messageCode,
  triggerEvent,
  bundle,
  s3Utils,
}: {
  cxId: string;
  patientId: string;
  encounterId: string;
  timestamp: string;
  messageId: string;
  messageCode: string;
  triggerEvent: string;
  bundle: Bundle<Resource>;
  context: string;
  s3Utils: S3Utils;
}) {
  const { log } = out(
    `putAdtConversionBundle - cx: ${cxId}, pt: ${patientId}, enc: ${encounterId}`
  );

  const newMessageBundleFileKey = createFileKeyAdtEncounter({
    cxId,
    patientId,
    encounterId,
    timestamp,
    messageId,
    messageCode,
    triggerEvent,
  });

  const result = (await s3Utils.uploadFile({
    bucket: s3BucketName,
    key: newMessageBundleFileKey,
    file: Buffer.from(JSON.stringify(bundle)),
  })) as AWS.S3.ManagedUpload.SendData & { VersionId: string };
  log(`Uploaded to S3 bucket: ${s3BucketName}. Filepath: ${newMessageBundleFileKey}`);

  return result;
}

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

  const fileKey = createFileKeyAdtLatest({
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

  const fileKey = createFileKeyAdtLatest({
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

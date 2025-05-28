import { Bundle, Resource } from "@medplum/fhirtypes";
import { MetriportError } from "@metriport/shared";
import { out } from "../../util";
import { Config } from "../../util/config";
import { HL7_FILE_EXTENSION, JSON_FILE_EXTENSION } from "../../util/mime";
import { S3Utils } from "../aws/s3";
import { mergeBundles } from "./shared/utils";

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

/**
 * Creates the file key that points to the
 * source of truth or "current state" for a given ADT encounter.
 *
 * @param cxId Customer ID
 * @param patientId Patient ID
 * @param encounterId Encounter ID
 * @returns The file key for the ADT encounter
 */
export function createFileKeyAdtSourcedEncounter({
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
  })}/encounter.${HL7_FILE_EXTENSION}.${JSON_FILE_EXTENSION}`;
}

/**
 * Creates the file key for the ADT to FHIR conversion
 *
 * @param cxId Customer ID
 * @param patientId Patient ID
 * @param encounterId Encounter ID
 * @param timestamp Timestamp of the message
 * @param messageId Message ID
 * @param messageCode Message code
 * @param triggerEvent Trigger event
 */
export function createFileKeyAdtConversion({
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
  })}/${timestamp}_${messageId}_${triggerEvent}.${HL7_FILE_EXTENSION}.${JSON_FILE_EXTENSION}`;
}

/**
 * Uploads the ADT to FHIR conversion output to S3
 *
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
export async function saveAdtConversionBundle({
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
    `saveAdtConversionBundle - cx: ${cxId}, pt: ${patientId}, enc: ${encounterId}`
  );

  const newMessageBundleFileKey = createFileKeyAdtConversion({
    cxId,
    patientId,
    encounterId,
    timestamp,
    messageId,
    messageCode,
    triggerEvent,
  });

  log(
    `Uploading conversion result to S3 bucket: ${s3BucketName}. Filepath: ${newMessageBundleFileKey}`
  );
  const result = await s3Utils.uploadFile({
    bucket: s3BucketName,
    key: newMessageBundleFileKey,
    file: Buffer.from(JSON.stringify(bundle)),
  });

  return result;
}

/**
 * Retrieves an ADT-sourced encounter from S3
 *
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

  const fileKey = createFileKeyAdtSourcedEncounter({
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

/**
 * If an encounter already exists for the encounterId, merge the new bundle into it
 * Otherwise, set the encounter to the new bundle.
 *
 * @param cxId Customer ID
 * @param patientId Patient ID
 * @param encounterId Encounter ID
 * @param newEncounterData The new bundle to merge into the existing encounter
 * @returns The encounter data as a parsed JSON object
 */
export async function mergeBundleIntoAdtSourcedEncounter({
  cxId,
  patientId,
  encounterId,
  newEncounterData,
}: {
  cxId: string;
  patientId: string;
  encounterId: string;
  newEncounterData: Bundle<Resource>;
}): Promise<{ bucket: string; key: string; versionId: string }> {
  const existingEncounterData = await getAdtSourcedEncounter({
    cxId,
    patientId,
    encounterId,
  });

  const currentEncounter = !existingEncounterData
    ? newEncounterData
    : mergeBundles({
        cxId,
        patientId,
        existing: existingEncounterData,
        current: newEncounterData,
        bundleType: "collection",
      });

  return await putAdtSourcedEncounter({
    cxId,
    patientId,
    encounterId,
    bundle: currentEncounter,
  });
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
}): Promise<{
  bucket: string;
  key: string;
  versionId: string;
}> {
  const { log } = out(
    `putAdtSourcedEncounter - cx: ${cxId}, pt: ${patientId}, enc: ${encounterId}`
  );

  const fileKey = createFileKeyAdtSourcedEncounter({
    cxId,
    patientId,
    encounterId,
  });

  log(`Uploading ADT encounter to S3 bucket: ${s3BucketName} at key: ${fileKey}`);
  const { versionId, ...result } = await s3Utils.uploadFile({
    bucket: s3BucketName,
    key: fileKey,
    file: Buffer.from(JSON.stringify(bundle)),
  });

  if (!versionId) {
    throw new MetriportError(
      "VersionId is required - you may be writing to the wrong bucket",
      undefined,
      {
        bucket: s3BucketName,
        key: fileKey,
      }
    );
  }

  return {
    ...result,
    versionId,
  };
}

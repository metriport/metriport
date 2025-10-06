import { Binary, Bundle, BundleEntry, Resource } from "@medplum/fhirtypes";
import { errorToString, executeWithNetworkRetries } from "@metriport/shared";
import { parseFhirBundle } from "@metriport/shared/medical/fhir/bundle";
import dayjs from "dayjs";
import duration from "dayjs/plugin/duration";
import { summarizeFilteredBundleWithAI } from "../../command/ai-brief/create";
import { prepareBundleForAiSummarization } from "../../command/ai-brief/filter";
import { AiBriefControls, generateAiBriefFhirResource } from "../../command/ai-brief/shared";
import { S3Utils } from "../../external/aws/s3";
import { buildBundleEntry, buildBundleFromResources } from "../../external/fhir/bundle/bundle";
import { capture } from "../../util";
import { Config } from "../../util/config";
import { JSON_FILE_EXTENSION } from "../../util/mime";

dayjs.extend(duration);

const AI_BRIEF_FILE_NAME = `ai_brief.${JSON_FILE_EXTENSION}`;
const maxAttempts = 3;
const waitTimeBetweenAttempts = dayjs.duration({ seconds: 0.2 });

export async function generateAiBriefBundleEntry(
  bundle: Bundle<Resource>,
  cxId: string,
  patientId: string,
  log: typeof console.log,
  aiBriefControls?: AiBriefControls
): Promise<BundleEntry<Binary> | undefined> {
  let aiBriefContent;
  let attemptNumber = 1;

  try {
    const filteredBundle = prepareBundleForAiSummarization(bundle, log);
    await executeWithNetworkRetries(
      async () => {
        log(`generateAiBriefBundleEntry - Attempt #: ${attemptNumber}`);
        aiBriefContent = await summarizeFilteredBundleWithAI(
          cxId,
          patientId,
          filteredBundle,
          aiBriefControls
        );
        attemptNumber++;
      },
      {
        maxAttempts,
        initialDelay: waitTimeBetweenAttempts.asMilliseconds(),
        log,
      }
    );

    if (aiBriefContent) {
      const aiBriefFhirResource = generateAiBriefFhirResource(aiBriefContent);
      await uploadAiBriefToS3(aiBriefFhirResource, cxId, patientId, log);
      return buildBundleEntry(aiBriefFhirResource);
    }
    return undefined;
  } catch (err) {
    attemptNumber++;
    const msg = `Failed to generate AI Brief with retries`;
    log(`${msg}. Error: ${errorToString(err)}`);
    capture.error(msg, {
      extra: {
        cxId,
        patientId,
        error: err,
      },
    });
    // Intentionally not throwing the error to avoid breaking the MR Summary generation flow
  }

  return undefined;
}

async function uploadAiBriefToS3(
  aiBriefFhirResource: Binary,
  cxId: string,
  patientId: string,
  log: typeof console.log
) {
  try {
    const aiBriefWrappedInBundle = buildBundleFromResources({
      resources: [aiBriefFhirResource],
    });
    const s3Utils = new S3Utils(Config.getAWSRegion());
    const key = getAiBriefFileKey(cxId, patientId);
    await s3Utils.uploadFile({
      bucket: Config.getAiBriefBucketName(),
      key,
      file: Buffer.from(JSON.stringify(aiBriefWrappedInBundle)),
    });
  } catch (err) {
    const msg = `Failed to upload AI Brief to S3`;
    log(`${msg}: ${errorToString(err)}`);
    capture.error(msg, {
      extra: {
        cxId,
        patientId,
        error: err,
      },
    });
  }
}

/**
 * Gets the AI Brief from S3, if it doesn't exist, generates a new one.
 *
 * @param cxId - The customer id.
 * @param patientId - The patient id.
 * @param bundle - The bundle to get the AI Brief from.
 * @param log - The log function.
 * @returns The AI Brief bundle entry.
 */
export async function getAiBriefFromS3({
  cxId,
  patientId,
  bundle,
  log,
  aiBriefControls,
}: {
  cxId: string;
  patientId: string;
  bundle: Bundle<Resource>;
  log: typeof console.log;
  aiBriefControls?: AiBriefControls;
}): Promise<BundleEntry<Binary> | undefined> {
  log("Getting AI Brief from S3");
  const s3Utils = new S3Utils(Config.getAWSRegion());
  const filePath = getAiBriefFileKey(cxId, patientId);

  try {
    const aiBrief = await s3Utils.getFileContentsAsString(Config.getAiBriefBucketName(), filePath);

    if (!aiBrief) {
      log(`No AI Brief found in S3, generating new one`);
      return await generateAiBriefBundleEntry(bundle, cxId, patientId, log, aiBriefControls);
    }

    log(`Got AI Brief from S3`);
    const aiBriefBundle = parseFhirBundle(aiBrief) as Bundle<Binary>;
    if (!aiBriefBundle) {
      log(`Failed to parse AI Brief bundle, generating new one`);
      return await generateAiBriefBundleEntry(bundle, cxId, patientId, log, aiBriefControls);
    }

    const aiBriefResource = getAiBriefResourceFromBundle(aiBriefBundle);
    if (!aiBriefResource) {
      log(`No AI Brief resource found in bundle, generating new one`);
      return await generateAiBriefBundleEntry(bundle, cxId, patientId, log, aiBriefControls);
    }

    return buildBundleEntry(aiBriefResource);
  } catch (err) {
    const msg = `Failed to get AI Brief from S3`;
    log(`${msg}: ${err}`);
    log(`Generating new AI Brief due to error`);
    return await generateAiBriefBundleEntry(bundle, cxId, patientId, log, aiBriefControls);
  }
}

function getAiBriefResourceFromBundle(bundle: Bundle<Binary>): Binary {
  if (!bundle.entry || bundle.entry.length === 0) {
    throw new Error("Ai Brief has no entries");
  }

  if (bundle.entry.length > 1) {
    throw new Error("Ai Brief has more than one entry");
  }
  const firstEntry = bundle.entry[0] as BundleEntry<Binary>;
  return firstEntry.resource as Binary;
}

function getAiBriefFileKey(cxId: string, patientId: string): string {
  return `${cxId}/${patientId}/${AI_BRIEF_FILE_NAME}`;
}

import { Binary, Bundle, BundleEntry, Resource } from "@medplum/fhirtypes";
import { errorToString, executeWithNetworkRetries } from "@metriport/shared";
import dayjs from "dayjs";
import duration from "dayjs/plugin/duration";
import { summarizeFilteredBundleWithAI } from "../../command/ai-brief/create";
import { prepareBundleForAiSummarization } from "../../command/ai-brief/filter";
import { AiBriefControls, generateAiBriefFhirResource } from "../../command/ai-brief/shared";
import { buildBundleEntry, buildBundleFromResources } from "../../external/fhir/bundle/bundle";
import { capture } from "../../util";
import { S3Utils } from "../../external/aws/s3";
import { Config } from "../../util/config";
import { JSON_FILE_EXTENSION } from "../../util/mime";

dayjs.extend(duration);

export const AI_BRIEF_FILE_NAME = `ai_brief.${JSON_FILE_EXTENSION}`;
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
    await s3Utils.uploadFile({
      bucket: Config.getAiBriefBucketName(),
      key: `${cxId}/${patientId}/${AI_BRIEF_FILE_NAME}`,
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

import { Binary, Bundle, BundleEntry, Resource } from "@medplum/fhirtypes";
import { errorToString, executeWithNetworkRetries } from "@metriport/shared";
import dayjs from "dayjs";
import duration from "dayjs/plugin/duration";
import { summarizeFilteredBundleWithAI } from "../../command/ai-brief/create";
import { generateAiBriefFhirResource } from "../../command/ai-brief/shared";
import { buildBundleEntry } from "../../external/fhir/shared/bundle";
import { capture } from "../../util";

dayjs.extend(duration);

const maxAttempts = 3;
const waitTimeBetweenAttempts = dayjs.duration({ seconds: 0.2 });

// TODO: 2526 - Refactor the retry with networks to only be used on the call to Bedrock
export async function generateAiBriefBundleEntry(
  bundle: Bundle<Resource>,
  cxId: string,
  patientId: string,
  log: typeof console.log
): Promise<BundleEntry<Binary> | undefined> {
  let aiBriefContent;
  let attemptNumber = 1;

  try {
    await executeWithNetworkRetries(
      async () => {
        aiBriefContent = await summarizeFilteredBundleWithAI(
          bundle,
          cxId,
          patientId,
          attemptNumber.toString()
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

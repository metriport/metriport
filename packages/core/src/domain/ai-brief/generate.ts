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
const waitTimeBetweenAttemptsInMs = dayjs.duration({ seconds: 0.2 }).asMilliseconds();

export async function generateAiBriefBundleEntry(
  bundle: Bundle<Resource>,
  cxId: string,
  patientId: string,
  log: typeof console.log
): Promise<BundleEntry<Binary> | undefined> {
  let binaryBundleEntry: BundleEntry<Binary> | undefined;

  try {
    await executeWithNetworkRetries(
      async () => {
        const aiBriefContent = await summarizeFilteredBundleWithAI(bundle, cxId, patientId);
        const aiBriefFhirResource = generateAiBriefFhirResource(aiBriefContent);
        if (aiBriefFhirResource) {
          binaryBundleEntry = buildBundleEntry(aiBriefFhirResource);
        }
      },
      {
        maxAttempts,
        initialDelay: waitTimeBetweenAttemptsInMs,
        log,
      }
    );

    return binaryBundleEntry;
  } catch (err) {
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

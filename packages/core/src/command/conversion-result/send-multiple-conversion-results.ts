import { errorToString, MetriportError } from "@metriport/shared";
import { groupBy } from "lodash";
import { out } from "../../util/log";
import { capture } from "../../util/notifications";
import { ConversionResult, ConversionResultWithCount } from "./types";
import { ConversionResultLocal } from "./conversion-result-local";

/**
 * Sends multiple conversion result notifications to the API.
 * Group them by patient and status, and send them as one request.
 *
 * @param requests - The requests to send.
 * @param apiUrl - The URL of the API to send the requests to.
 */
export async function sendConversionResults({
  results,
  apiUrl,
}: {
  results: ConversionResult[];
  apiUrl: string;
}): Promise<ConversionResultWithCount[]> {
  const conversionResultHandler = new ConversionResultLocal(apiUrl);
  const resultsWithCount: ConversionResultWithCount[] = [];

  // TODO group this by patientId only, with the count move to an array of source/status
  const groupedByPatientId = groupBy(results, r => r.patientId + "|" + r.source + "|" + r.status);

  for (const [patientStatus, requests] of Object.entries(groupedByPatientId)) {
    const [patientId, source, status] = patientStatus.split("|");
    const { log } = out(`patient ${patientId}, source ${source}, status ${status}`);

    log(`${requests.length} requests to send as one`);

    const firstRequest = requests[0];
    if (!firstRequest) throw new MetriportError(`Programming error: missing first request`);

    const request: ConversionResultWithCount = {
      ...firstRequest,
      count: requests.length,
    };

    try {
      await conversionResultHandler.notifyApi(request, log);
      resultsWithCount.push(request);
    } catch (error) {
      // Can't bubble up because we might have multiple patients, which mean multiple
      // requests to the API, and we don't know which one was processed or failed.
      // Bubbling up would send the message to DLQ and we can't reprocess it b/c of
      // the above.
      const msg = `Error processing conversion result notification`;
      const extra = {
        context: "conversion-result-notifier",
        patientId,
        status,
        requests,
        error,
      };
      log(`${msg}, error: ${errorToString(error)}, extra: ${JSON.stringify(extra)}`);
      capture.error(msg, { extra });
    }
  }

  return resultsWithCount;
}

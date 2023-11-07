import { MetriportMedicalApi } from "@metriport/api-sdk";
import { sleep } from "@metriport/core/util/sleep";
import axios from "axios";

export type DetailedConfig = {
  patientChunkDelayJitterMs: number;
  queryPollDurationMs: number;
  maxQueryDurationMs: number; // CW has a 70s timeout, so this is the maximum duration any doc query can take
  maxDocQueryAttemts: number;
  /**
   * If the doc query returns less than this, we want to query again to try and get better
   * coverage. Had situation where we requeried a patient w/ 1 doc ref and it jumped from
   * 1 to 20.
   */
  minDocsToConsiderCompleted: number;
};
export type QueryParams = {
  cxId: string;
  patientId: string;
  apiUrl: string;
  apiKey: string;
  triggerWHNotificationsToCx: boolean;
  config?: DetailedConfig;
  log?: typeof console.log;
};

export async function queryDocsForPatient({
  cxId,
  patientId,
  apiUrl,
  apiKey,
  // TODO 1106 Remove this directive
  triggerWHNotificationsToCx, // eslint-disable-line @typescript-eslint/no-unused-vars
  config = {
    patientChunkDelayJitterMs: 1000,
    queryPollDurationMs: 10_000,
    maxQueryDurationMs: 71_000,
    maxDocQueryAttemts: 3,
    minDocsToConsiderCompleted: 2,
  },
  log = console.log,
}: QueryParams): Promise<{
  docQueryAttempts: number;
  docsFound: number;
  queryComplete: boolean;
}> {
  const {
    patientChunkDelayJitterMs,
    queryPollDurationMs,
    maxQueryDurationMs,
    maxDocQueryAttemts,
    minDocsToConsiderCompleted,
  } = config;
  let docQueryAttempts = 0;
  let docsFound = 0;
  let queryComplete = false;

  const metriportAPI = new MetriportMedicalApi(apiKey, {
    baseAddress: apiUrl,
  });
  async function triggerDocQuery(patientId: string): Promise<void> {
    // TODO 1106 send this along the request
    // triggerWHNotificationsToCx
    await axios.post(`${apiUrl}/internal/docs/query?cxId=${cxId}&patientId=${patientId}`);
  }

  while (docQueryAttempts < maxDocQueryAttemts) {
    log(`Starting doc query for patient ${patientId}...`);

    // can't use the SDK b/c we need to bypass the feature flag that disables doc query for enhanced coverage customers
    await triggerDocQuery(patientId);

    // add a bit of jitter to the requests
    await sleep(200 + Math.random() * patientChunkDelayJitterMs);

    const queryStartTime = Date.now();
    while (Date.now() - queryStartTime < maxQueryDurationMs) {
      const docQueryStatus = await metriportAPI.getDocumentQueryStatus(patientId);
      if (
        docQueryStatus.download &&
        docQueryStatus.download.total &&
        docQueryStatus.download.total >= minDocsToConsiderCompleted
      ) {
        queryComplete = true;
        docsFound = docQueryStatus.download.total;
        break;
      }
      await sleep(queryPollDurationMs);
    }
    docQueryAttempts++;
    if (queryComplete) break;
    log(`Didn't find docs for patient ${patientId} on attempt ${docQueryAttempts}...`);
  }

  return {
    docQueryAttempts,
    docsFound,
    queryComplete,
  };
}

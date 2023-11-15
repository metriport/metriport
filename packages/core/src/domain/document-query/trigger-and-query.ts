import { DocumentQuery } from "@metriport/api-sdk";
import { sleep } from "../../util/sleep";
import { webhookDisableFlagName } from "../webhook";

const patientChunkDelayJitterMsDefault = 1000;
const queryPollDurationMsDefault = 10_000;
const maxQueryDurationMsDefault = 71_000;
const maxDocQueryAttemptsDefault = 1;
const minDocsToConsiderCompletedDefault = 1;

export const disableWHMetadata = {
  [webhookDisableFlagName]: "true",
};

export type DetailedConfig = {
  patientChunkDelayJitterMs?: number | undefined;
  queryPollDurationMs?: number | undefined;
  maxQueryDurationMs?: number | undefined; // CW has a 70s timeout, so this is the maximum duration any doc query can take
  maxDocQueryAttempts?: number | undefined;
  /**
   * If the doc query returns less than this, we want to query again to try and get better
   * coverage. Had situation where we requeried a patient w/ 1 doc ref and it jumped from
   * 1 to 20.
   */
  minDocsToConsiderCompleted?: number | undefined;
};

export type QueryParams = {
  cxId: string;
  patientId: string;
  triggerWHNotificationsToCx: boolean;
  config?: DetailedConfig;
  log?: typeof console.log;
};

export abstract class TriggerAndQueryDocRefs {
  protected abstract triggerDocQuery(
    cxId: string,
    patientId: string,
    triggerWHNotifs: boolean
  ): Promise<void>;

  protected abstract getDocQueryStatus(
    cxId: string,
    patientId: string
  ): Promise<DocumentQuery | undefined>;

  public async queryDocsForPatient({
    cxId,
    patientId,
    triggerWHNotificationsToCx,
    config = {},
    log = console.log,
  }: QueryParams): Promise<{
    docQueryAttempts: number;
    docsFound: number;
    queryComplete: boolean;
  }> {
    const {
      patientChunkDelayJitterMs = patientChunkDelayJitterMsDefault,
      queryPollDurationMs = queryPollDurationMsDefault,
      maxQueryDurationMs = maxQueryDurationMsDefault,
      maxDocQueryAttempts = maxDocQueryAttemptsDefault,
      minDocsToConsiderCompleted = minDocsToConsiderCompletedDefault,
    } = config;
    let docsFound = 0;

    const triggerDQAndCheckResults = async ({ triggerWH }: { triggerWH: boolean }) => {
      log(
        `Starting doc query for patient ${patientId}... (triggerWHNotificationsToCx=${triggerWHNotificationsToCx})`
      );
      // can't use the SDK b/c we need to bypass the feature flag that disables doc query for enhanced coverage customers
      await this.triggerDocQuery(cxId, patientId, triggerWH);
      // add a bit of jitter to the requests
      await sleep(200 + Math.random() * patientChunkDelayJitterMs);
      // query for some time until we get the results we expect or give up if timedout
      const queryStartTime = Date.now();
      while (Date.now() - queryStartTime < maxQueryDurationMs) {
        const docQueryStatus = await this.getDocQueryStatus(cxId, patientId);
        if (
          docQueryStatus &&
          docQueryStatus.download &&
          docQueryStatus.download.total &&
          docQueryStatus.download.total >= minDocsToConsiderCompleted
        ) {
          docsFound = docQueryStatus.download.total;
          return true;
        }
        await sleep(queryPollDurationMs);
      }
      return false;
    };

    // We need to send (exactly) one doc query with WH notification.
    // So all we'll run a few on a loop without WH notif...
    const maxAttemptsOnLoop = Math.max(0, maxDocQueryAttempts - 1);
    let docQueryAttempts = 0;
    let queryComplete = false;
    while (docQueryAttempts++ < maxAttemptsOnLoop) {
      queryComplete = await triggerDQAndCheckResults({ triggerWH: false });
      if (queryComplete) break;
      log(`Didn't find docs for patient ${patientId} on attempt ${docQueryAttempts}...`);
    }
    // ...and a single one with WH notif according to the param we got:

    // If we already got the amount of docs refs we need but need to send WH notif, trigger
    // a new DQ with WH notif set
    if (queryComplete && triggerWHNotificationsToCx) {
      await this.triggerDocQuery(cxId, patientId, true);
      return {
        docQueryAttempts,
        docsFound,
        queryComplete,
      };
    }
    // If we didn't get the amount of docs refs we need, trigger a new DQ and check for results
    if (!queryComplete) {
      queryComplete = await triggerDQAndCheckResults({ triggerWH: triggerWHNotificationsToCx });
      return {
        docQueryAttempts,
        docsFound,
        queryComplete,
      };
    }
    // If we already got the amount of docs refs we need and don't want to send WH notif, just return
    return {
      docQueryAttempts,
      docsFound,
      queryComplete,
    };
  }
}

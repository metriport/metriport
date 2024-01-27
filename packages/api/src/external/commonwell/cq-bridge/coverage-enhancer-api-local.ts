import { CoverageEnhancementParams } from "@metriport/core/external/commonwell/cq-bridge/coverage-enhancer";
import { CoverageEnhancerLocal } from "@metriport/core/external/commonwell/cq-bridge/coverage-enhancer-local";
import { CommonWellManagementAPI } from "@metriport/core/external/commonwell/management/api";
import { sleep } from "@metriport/core/util/sleep";
import dayjs from "dayjs";
import duration from "dayjs/plugin/duration";
import { out } from "../../../shared/log";
import { capture } from "../../../shared/notifications";
import { PatientLoaderLocal } from "../patient-loader-local";
import { PatientUpdaterCommonWell } from "../patient-updater-commonwell";
import { completeEnhancedCoverage } from "./coverage-enhancement-complete";
import { ECUpdaterLocal } from "./ec-updater-local";

dayjs.extend(duration);

const WAIT_BETWEEN_LINKING_AND_DOC_QUERY = dayjs.duration({ seconds: 30 });

/**
 * Implementation of the Enhanced Coverage flow with the logic running on local environment on
 * the API.
 */
export class CoverageEnhancerApiLocal extends CoverageEnhancerLocal {
  constructor(cwManagementApi: CommonWellManagementAPI, prefix?: string | undefined) {
    super(
      cwManagementApi,
      new PatientLoaderLocal(),
      new PatientUpdaterCommonWell(),
      new ECUpdaterLocal(),
      capture,
      prefix
    );
  }

  public override async enhanceCoverage({
    waitBetweenLinkingAndDocQuery = WAIT_BETWEEN_LINKING_AND_DOC_QUERY,
    startedAt = Date.now(),
    ...params
  }: CoverageEnhancementParams & {
    waitBetweenLinkingAndDocQuery: duration.Duration;
    startedAt?: number;
  }): Promise<string> {
    const { cxId, patientIds } = params;

    const ecId = await super.enhanceCoverage(params);

    const { log } = out(`EC ${ecId} - cx ${cxId}`);

    const waitTime = waitBetweenLinkingAndDocQuery.asMilliseconds();
    log(`Giving some time for patients to be updated @ CW... (${waitTime} ms)`);
    await sleep(waitTime);

    await completeEnhancedCoverage({ ecId, cxId, patientIds, cqLinkStatus: "linked" });

    const duration = Date.now() - startedAt;
    const durationMin = dayjs.duration(duration).asMinutes();
    log(`Done, total time: ${duration} ms / ${durationMin} min`);

    return ecId;
  }
}

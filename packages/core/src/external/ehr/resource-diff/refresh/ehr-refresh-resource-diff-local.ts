import { sleep } from "@metriport/shared";
import { fetchResources } from "../../api/resource-diff/fetch-resources";
import { getSupportedResources } from "../utils";
import {
  EhrRefreshResourceDiffHandler,
  RefreshResourceDiffRequest,
} from "./ehr-refresh-resource-diff";

export class EhrRefreshResourceDiffLocal implements EhrRefreshResourceDiffHandler {
  constructor(private readonly waitTimeInMillis: number) {}

  async refreshResourceDiff({
    ehr,
    cxId,
    practiceId,
    patientId,
  }: RefreshResourceDiffRequest): Promise<void> {
    const supportedResources = getSupportedResources(ehr);
    await Promise.all(
      supportedResources.map(resourceType =>
        fetchResources({
          ehr,
          cxId,
          practiceId,
          patientId,
          resourceType,
          useS3: false,
        })
      )
    );
    if (this.waitTimeInMillis > 0) await sleep(this.waitTimeInMillis);
  }
}

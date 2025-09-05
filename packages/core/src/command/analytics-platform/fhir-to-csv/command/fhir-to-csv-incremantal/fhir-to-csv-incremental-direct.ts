import { sleep } from "@metriport/shared";
import { out } from "../../../../../util/log";
import { addPatientCsvsToTrain } from "../../../train-builder/incremental-to-train";
import { startFhirToCsvTransform } from "../fhir-to-csv-transform";
import {
  FhirToCsvIncrementalHandler,
  ProcessFhirToCsvIncrementalRequest,
} from "./fhir-to-csv-incremental";
import { buildFhirToCsvIncrementalJobPrefix } from "../../file-name";

export class FhirToCsvIncrementalDirect implements FhirToCsvIncrementalHandler {
  constructor(
    private readonly analyticsBucketName: string,
    private readonly region: string,
    private readonly waitTimeInMillis: number = 0
  ) {}

  async processFhirToCsvIncremental({
    cxId,
    jobId,
    patientId,
    timeoutInMillis,
  }: ProcessFhirToCsvIncrementalRequest): Promise<void> {
    const { log } = out(`FhirToCsvIncrementalDirect - cx ${cxId} pt ${patientId} job ${jobId}`);

    const outputPrefix = buildFhirToCsvIncrementalJobPrefix({ cxId, patientId });

    const startedAt = Date.now();
    log(`Starting FhirToCsvTransform...`);
    await startFhirToCsvTransform({
      cxId,
      jobId,
      patientId,
      outputPrefix,
      timeoutInMillis,
    });

    log(`Done in ${Date.now() - startedAt}ms, copying files to the ingestion train...`);
    await addPatientCsvsToTrain({
      cxId,
      patientId,
      patientCsvsS3Prefix: outputPrefix,
      analyticsBucketName: this.analyticsBucketName,
      region: this.region,
    });

    if (this.waitTimeInMillis > 0) await sleep(this.waitTimeInMillis);
  }
}

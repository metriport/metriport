import { DbCreds, sleep } from "@metriport/shared";
import { out } from "../../../../../util/log";
import { sendPatientCsvsToDb } from "../../../csv-to-db/send-csvs-to-db";
import { buildFhirToCsvIncrementalJobPrefix } from "../../file-name";
import { startFhirToCsvTransform } from "../fhir-to-csv-transform";
import {
  FhirToCsvIncrementalHandler,
  ProcessFhirToCsvIncrementalRequest,
} from "./fhir-to-csv-incremental";

export class FhirToCsvIncrementalDirect implements FhirToCsvIncrementalHandler {
  constructor(
    private readonly analyticsBucketName: string,
    private readonly region: string,
    private readonly dbCreds: DbCreds,
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

    log(`Done in ${Date.now() - startedAt}ms, storing flattened data in the DB...`);
    await sendPatientCsvsToDb({
      cxId,
      patientId,
      patientCsvsS3Prefix: outputPrefix,
      analyticsBucketName: this.analyticsBucketName,
      region: this.region,
      dbCreds: this.dbCreds,
    });

    if (this.waitTimeInMillis > 0) await sleep(this.waitTimeInMillis);
  }
}

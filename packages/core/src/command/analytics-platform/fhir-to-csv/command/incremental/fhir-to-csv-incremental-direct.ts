import { DbCreds, sleep } from "@metriport/shared";
import { buildDayjs } from "@metriport/shared/common/date";
import { customAlphabet } from "nanoid";
import { out } from "../../../../../util/log";
import { sendPatientCsvsToDb } from "../../../csv-to-db/send-csvs-to-db";
import { buildFhirToCsvIncrementalJobPrefix } from "../../file-name";
import { buildFhirToCsvTransformHandler } from "../transform/fhir-to-csv-transform-factory";
import {
  FhirToCsvIncrementalHandler,
  ProcessFhirToCsvIncrementalRequest,
} from "./fhir-to-csv-incremental";

const alphabet = "0123456789abcdefghijklmnopqrstuvwxyz";
export const nanoid = customAlphabet(alphabet, 10);

export class FhirToCsvIncrementalDirect implements FhirToCsvIncrementalHandler {
  constructor(
    private readonly analyticsBucketName: string,
    private readonly region: string,
    private readonly dbCreds: DbCreds,
    private readonly tablesDefinitions: Record<string, string>,
    private readonly waitTimeInMillis: number = 0
  ) {}

  async processFhirToCsvIncremental({
    cxId,
    patientId,
    jobId = this.generateJobId(),
    timeoutInMillis,
  }: ProcessFhirToCsvIncrementalRequest): Promise<void> {
    const { log } = out(`FhirToCsvIncrementalDirect - cx ${cxId} pt ${patientId}`);

    const outputPrefix = buildFhirToCsvIncrementalJobPrefix({ cxId, patientId });

    const startedAt = Date.now();
    log(`Starting FhirToCsvTransform...`);
    const handler = buildFhirToCsvTransformHandler();
    await handler.startFhirToCsvTransform({
      cxId,
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
      tablesDefinitions: this.tablesDefinitions,
      jobId,
    });

    if (this.waitTimeInMillis > 0) await sleep(this.waitTimeInMillis);
  }

  private generateJobId(): string {
    return (
      buildDayjs().toISOString().replace(/[-:.]/g, "").replace("T", "-").substring(0, 18) +
      "-" +
      nanoid()
    );
  }
}

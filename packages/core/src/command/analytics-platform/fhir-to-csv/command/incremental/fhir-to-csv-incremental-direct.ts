import { DbCreds, dbCredsSchema, MetriportError, sleep } from "@metriport/shared";
import { Config } from "../../../../../util/config";
import { out } from "../../../../../util/log";
import { sendPatientCsvsToDb } from "../../../csv-to-db/send-csvs-to-db";
import { buildFhirToCsvIncrementalJobPrefix } from "../../file-name";
import { buildFhirToCsvTransformHandler } from "../transform/fhir-to-csv-transform-factory";
import {
  FhirToCsvIncrementalHandler,
  ProcessFhirToCsvIncrementalRequest,
} from "./fhir-to-csv-incremental";

export class FhirToCsvIncrementalDirect implements FhirToCsvIncrementalHandler {
  constructor(
    private readonly analyticsBucketName: string | undefined = Config.getAnalyticsBucketName(),
    private readonly region: string = Config.getAWSRegion(),
    private readonly dbCreds: DbCreds = dbCredsSchema.parse(
      JSON.parse(Config.getAnalyticsDbCreds())
    ),
    private readonly waitTimeInMillis: number = 0
  ) {}

  async processFhirToCsvIncremental({
    cxId,
    patientId,
    timeoutInMillis,
  }: ProcessFhirToCsvIncrementalRequest): Promise<void> {
    const { log } = out(`FhirToCsvIncrementalDirect - cx ${cxId} pt ${patientId}`);

    if (!this.analyticsBucketName) throw new MetriportError("Analytics bucket name is not set");

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
    });

    if (this.waitTimeInMillis > 0) await sleep(this.waitTimeInMillis);
  }
}

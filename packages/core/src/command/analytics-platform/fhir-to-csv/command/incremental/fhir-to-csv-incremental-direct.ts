import { DbCreds } from "@metriport/shared";
import { out } from "../../../../../util/log";
import { sendPatientCsvsToDb } from "../../../csv-to-db/send-csvs-to-db";
import { buildFhirToCsvIncrementalJobPrefix } from "../../file-name";
import { buildFhirToCsvTransformHandler } from "../transform/fhir-to-csv-transform-factory";
import {
  FhirToCsvIncrementalHandler,
  ProcessFhirToCsvIncrementalRequest,
} from "./fhir-to-csv-incremental";

export class FhirToCsvIncrementalDirect extends FhirToCsvIncrementalHandler {
  constructor(
    private readonly analyticsBucketName: string,
    private readonly region: string,
    private readonly dbCreds: DbCreds,
    private readonly tablesDefinitions: Record<string, string>
  ) {
    super();
  }

  async processFhirToCsvIncremental({
    cxId,
    patientId,
    jobId = this.generateJobId(),
  }: ProcessFhirToCsvIncrementalRequest): Promise<string> {
    const { log } = out(`FhirToCsvIncrementalDirect - cx ${cxId} pt ${patientId}`);

    const outputPrefix = buildFhirToCsvIncrementalJobPrefix({ cxId, patientId });

    const startedAt = Date.now();
    log(`Starting FhirToCsvTransform...`);
    const handler = buildFhirToCsvTransformHandler();
    await handler.runFhirToCsvTransform({
      cxId,
      patientId,
      outputPrefix,
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

    return jobId;
  }
}

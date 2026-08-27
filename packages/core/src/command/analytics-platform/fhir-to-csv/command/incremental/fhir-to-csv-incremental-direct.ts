import { DbCreds, MetriportError } from "@metriport/shared";
import { Config } from "../../../../../util/config";
import { processAsyncError } from "../../../../../util/error/shared";
import { out } from "../../../../../util/log";
import { TableDefinitions } from "../../../fwh/utils";
import { buildFhirToCsvIncrementalJobPrefix } from "../../file-name";
import { buildFhirToCsvTransformHandler } from "../transform/fhir-to-csv-transform-factory";
import {
  FhirToCsvIncrementalHandler,
  ProcessFhirToCsvIncrementalRequest,
} from "./fhir-to-csv-incremental";
import { sendPatientCsvsToDb } from "./utils";
import { doesConsolidatedDataExist } from "../../../../consolidated/consolidated-exists";

export class FhirToCsvIncrementalDirect extends FhirToCsvIncrementalHandler {
  constructor(
    private readonly tablesDefinitions: TableDefinitions,
    private readonly dbCreds: DbCreds,
    private readonly analyticsBucketName: string = Config.getAnalyticsBucketName(),
    private readonly region: string = Config.getAWSRegion()
  ) {
    super();
  }

  async processFhirToCsvIncremental({
    cxId,
    patientId,
    jobId = this.generateJobId(),
  }: ProcessFhirToCsvIncrementalRequest): Promise<string> {
    this.processFhirToCsvIncrementalSync({
      cxId,
      patientId,
      jobId,
    }).catch(processAsyncError(`FhirToCsvIncrementalDirect processFhirToCsvIncrementalSync`));
    return jobId;
  }

  async processFhirToCsvIncrementalSync({
    cxId,
    patientId,
    jobId = this.generateJobId(),
  }: ProcessFhirToCsvIncrementalRequest): Promise<string> {
    const { log } = out(
      `FhirToCsvIncrementalDirect.processFhirToCsvIncrementalSync - cx ${cxId} pt ${patientId}`
    );

    const doesPatientHaveConsolidatedBundle = await doesConsolidatedDataExist(cxId, patientId);
    if (!doesPatientHaveConsolidatedBundle) {
      const msg = `Patient does not have a consolidated bundle`;
      log(msg);
      throw new MetriportError(msg, undefined, { cxId, patientId });
    }

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

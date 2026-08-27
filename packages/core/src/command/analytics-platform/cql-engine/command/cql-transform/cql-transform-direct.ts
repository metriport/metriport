import { BadRequestError, errorToString, MetriportError } from "@metriport/shared";
import { CqlTransformRequest } from "@metriport/shared/domain/cql-engine/transform";
import { measures as hedisMeasures } from "../../../../../external/hedis/measures";
import { out } from "../../../../../util";
import { executeAsynchronously } from "../../../../../util/concurrency";
import { Config } from "../../../../../util/config";
import { processAsyncError } from "../../../../../util/error/shared";
import { capture } from "../../../../../util/notifications";
import { generateBulkJobKeyPrefix } from "../../util/file-name";
import {
  generatePatientBundleKey,
  getPatientBundle,
  uploadPatientBundleToS3,
} from "../../util/patient";
import { buildHedisCliHandler } from "../hedis-cli/hedis-cli-factory";
import { CqlTransformHandler } from "./cql-transform";

const MAX_NUMBER_OF_PARALLEL_EXECUTIONS = 100;

export class CqlTransformDirect extends CqlTransformHandler {
  constructor(
    private readonly analyticsBucketName: string | undefined = Config.getAnalyticsBucketName()
  ) {
    super();
  }

  async processCqlTransform({
    cxId,
    patientId,
    jobId = this.generateHedisJobId(),
    patientBundleS3Key,
    measuresToExecute,
    mode,
    parameters,
  }: CqlTransformRequest): Promise<string> {
    this.processCqlTransformSync({
      cxId,
      patientId,
      jobId,
      patientBundleS3Key,
      measuresToExecute,
      mode,
      parameters,
    }).catch(processAsyncError(`CqlTransformDirect processCqlTransformSync`));
    return jobId;
  }

  async processCqlTransformSync({
    cxId,
    patientId,
    jobId = this.generateHedisJobId(),
    patientBundleS3Key,
    measuresToExecute,
    mode,
    parameters,
  }: CqlTransformRequest): Promise<void> {
    const { log } = out(
      `CqlTransformDirect.processCqlTransformSync - cx ${cxId}, patient ${patientId}, job ${jobId}`
    );

    if (!this.analyticsBucketName) {
      throw new MetriportError("Analytics bucket name is required", undefined, {
        cxId,
        patientId,
        jobId,
      });
    }
    if (!this.isHedisJobId(jobId)) {
      throw new BadRequestError(
        "No HEDIS job ID provided, only HEDIS jobs are supported",
        undefined,
        {
          cxId,
          patientId,
          jobId,
        }
      );
    }

    const jobPrefix = generateBulkJobKeyPrefix({ customerId: cxId, jobId, patientId });
    const patientBundle = await getPatientBundle({
      ...(patientBundleS3Key && {
        s3Params: {
          key: patientBundleS3Key,
          bucket: this.analyticsBucketName,
        },
      }),
      cxId,
      patientId,
    });
    if (!patientBundle) {
      log(`No patient bundle found, skipping execution`);
      throw new BadRequestError("No patient bundle found", undefined, {
        cxId,
        patientId,
        jobId,
      });
    }

    const patientBundleKey = generatePatientBundleKey(jobPrefix);
    log(`Uploading patient bundle to s3://${this.analyticsBucketName}/${patientBundleKey}`);
    // TODO ENG-1623: Move readwrite in S3 to S3 copy for CQL Transform
    await uploadPatientBundleToS3({
      patientBundle,
      bucket: this.analyticsBucketName,
      key: patientBundleKey,
    });
    log(`Patient bundle uploaded successfully`);

    let measures: string[] = [];
    if (measuresToExecute && measuresToExecute.length > 0) {
      measures = measuresToExecute.filter(measure => hedisMeasures.includes(measure));
      if (measures.length < 1) {
        throw new BadRequestError("No measures found from supplied list", undefined, {
          cxId,
          patientId,
          jobId,
        });
      }
    } else {
      measures = hedisMeasures;
    }
    log(`Using specified measures: ${measures.join(", ")}`);

    const results = await executeAsynchronously(
      measures,
      async (measureName: string, index: number) => {
        log(`[${index + 1}/${measures.length}] Executing measure: ${measureName}`);

        const hedisCliHandler = buildHedisCliHandler();
        await hedisCliHandler.invokeHedisCli({
          patientBundleS3Key: patientBundleKey,
          measureName,
          outputMeasureReportS3Path: jobPrefix,
          ...(mode && { mode }),
          ...(parameters && { parameters }),
        });
        log(`[${index + 1}/${measures.length}] Completed measure: ${measureName}`);
      },
      {
        keepExecutingOnError: true,
        log: (msg: string) => console.log(`[cql-transform] ${msg}`),
        numberOfParallelExecutions: MAX_NUMBER_OF_PARALLEL_EXECUTIONS,
      }
    );

    const indexedResults = results.map((r, idx) => ({ r, idx }));
    const failures = indexedResults.filter(({ r }) => r.status === "rejected");
    if (failures.length > 0) {
      const failedMeasures = failures
        .map(
          ({ r, idx }) => `${measures[idx]}: ${errorToString((r as PromiseRejectedResult).reason)}`
        )
        .join(", ");
      const msg = "Failed to process some CQL executions";
      log(`${msg}: ${failedMeasures}`);
      capture.error(msg, { extra: { cxId, patientId, jobId, failedMeasures } });
    }
    log(`Successfully completed CQL transform`);
  }
}

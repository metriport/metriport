import {
  createFileKeyInvalid,
  createFileKeyResults,
} from "@metriport/core/command/patient-import/patient-import-shared";
import { buildPatientImportParseHandler } from "@metriport/core/command/patient-import/steps/parse/patient-import-parse-factory";
import { buildPatientImportResult } from "@metriport/core/command/patient-import/steps/result/patient-import-result-factory";
import { getResultEntries } from "@metriport/core/command/patient-import/steps/result/patient-import-result-local";
import { S3Utils } from "@metriport/core/external/aws/s3";
import { capture } from "@metriport/core/util";
import { executeAsynchronously } from "@metriport/core/util/concurrency";
import { Config } from "@metriport/core/util/config";
import {
  addPatientMappingSchema,
  updateJobSchema,
} from "@metriport/shared/domain/patient/patient-import/schemas";
import { validateNewStatus } from "@metriport/shared/domain/patient/patient-import/status";
import { PatientImportJob } from "@metriport/shared/domain/patient/patient-import/types";
import dayjs from "dayjs";
import duration from "dayjs/plugin/duration";
import { Request, Response } from "express";
import Router from "express-promise-router";
import status from "http-status";
import { z } from "zod";
import { getPatientOrFail } from "../../../command/medical/patient/get-patient";
import { createPatientImportJob } from "../../../command/medical/patient/patient-import/create";
import {
  getPatientImportJobList,
  getPatientImportJobOrFail,
} from "../../../command/medical/patient/patient-import/get";
import {
  createPatientImportMapping,
  CreatePatientImportMappingCmd,
} from "../../../command/medical/patient/patient-import/mapping/create";
import { updatePatientImportParams } from "../../../command/medical/patient/patient-import/update-params";
import { updatePatientImportTracking } from "../../../command/medical/patient/patient-import/update-tracking";
import { getCQData } from "../../../external/carequality/patient";
import { getCWData } from "../../../external/commonwell-v1/patient";
import { requestLogger } from "../../helpers/request-logger";
import { getUUIDFrom } from "../../schemas/uuid";
import {
  asyncHandler,
  getFrom,
  getFromParamsOrFail,
  getFromQuery,
  getFromQueryAsBoolean,
  getFromQueryAsBooleanOrFail,
} from "../../util";

dayjs.extend(duration);

const router = Router();

/** ---------------------------------------------------------------------------
 * POST /internal/patient/bulk
 *
 * Creates a bulk patient import. This is an alternative entry point to the bulk import process,
 * which can be triggered by a cx through the public POST /medical/v1/patient/bulk or this endpoint
 * by our team.
 *
 * Typically used during onboarding, when we're doing a Coverage Assessment for a new customer.
 *
 * @param req.query.cxId The customer ID.
 * @param req.query.facilityId The ID of the Facility the Patients should be associated with
 *        (optional if there's only one facility for the customer, fails if not provided and
 *        there's more than one facility for the customer).
 * @param req.query.dryRun Whether to simply validate the file or actually import it.
 * @param req.query.rerunPdOnNewDemographics Optional: Indicates whether to use demo augmentation
 *        on this PD run.
 * @param req.query.triggerConsolidated - Optional; Whether to force get consolidated PDF on
 *        conversion finish.
 * @param req.query.disableWebhooks Optional: Indicates whether send webhooks, applies to both
 *        the data pipeline and the bulk import webhooks.
 */
router.post(
  "/",
  requestLogger,
  asyncHandler(async (req: Request, res: Response) => {
    const cxId = getUUIDFrom("query", req, "cxId").orFail();
    const facilityId = getFromQuery("facilityId", req);
    const triggerConsolidated = getFromQueryAsBoolean("triggerConsolidated", req);
    const disableWebhooks = getFromQueryAsBoolean("disableWebhooks", req);
    const rerunPdOnNewDemographics = getFromQueryAsBoolean("rerunPdOnNewDemographics", req);
    // Required here so we need to be intentional about whether we're running it in dry run mode
    // or not. Optional on the PatientImportParamsOps type because it's not set by the cx.
    const dryRun = getFromQueryAsBooleanOrFail("dryRun", req);

    const patientImportResponse = await createPatientImportJob({
      cxId,
      facilityId,
      paramsOps: {
        dryRun,
        rerunPdOnNewDemographics,
        triggerConsolidated,
        disableWebhooks,
      },
    });

    return res.status(status.OK).json(patientImportResponse);
  })
);

/** ---------------------------------------------------------------------------
 * POST /internal/patient/bulk/:id/continue
 *
 * Only to be used to fix/continue a stuck job.
 *
 * Continues the process of parsing a bulk patient import job, initiated either by a cx through
 * the public POST /medical/v1/patient/bulk or the internal POST /internal/patient/bulk.
 *
 * @param req.params.id The patient import job ID.
 * @param req.query.cxId The customer ID.
 * @param req.query.rerunPdOnNewDemographics Optional: Indicates whether to use demo augmentation on this PD run.
 * @param req.query.triggerConsolidated - Optional; Whether to force get consolidated PDF on conversion finish.
 * @param req.query.disableWebhooks Optional: Indicates whether send webhooks, applies to both
 *        the data pipeline and the bulk import webhooks.
 * @param req.query.forceStatusUpdate Optional: Indicates whether to bypass the job status validation (state machine).
 * @param req.query.dryRun Whether to simply validate or run the assessment, overrides the cx
 *                         provided one.
 */
router.post(
  "/:id/continue",
  requestLogger,
  asyncHandler(async (req: Request, res: Response) => {
    const cxId = getUUIDFrom("query", req, "cxId").orFail();
    const jobId = getFromParamsOrFail("id", req);
    // job params - to be stored in the repository
    const rerunPdOnNewDemographics = getFromQueryAsBoolean("rerunPdOnNewDemographics", req);
    const triggerConsolidated = getFromQueryAsBoolean("triggerConsolidated", req);
    const disableWebhooks = getFromQueryAsBoolean("disableWebhooks", req);
    const dryRun = getFromQueryAsBooleanOrFail("dryRun", req);
    // request param - just being passed as parameter to this particular request
    const forceStatusUpdate = getFromQueryAsBoolean("forceStatusUpdate", req);
    capture.setExtra({ cxId, jobId });

    await updatePatientImportParams({
      cxId,
      jobId,
      rerunPdOnNewDemographics,
      triggerConsolidated,
      disableWebhooks,
      dryRun,
    });

    const patientImportParser = buildPatientImportParseHandler();
    await patientImportParser.processJobParse({
      cxId,
      jobId,
      forceStatusUpdate,
    });

    return res.sendStatus(status.OK);
  })
);

/** ---------------------------------------------------------------------------
 * POST /internal/patient/bulk/:id/done
 *
 * IMPORTANT: Only to be used to unstuck a bulk patient import job.
 *
 * Finishes a bulk patient import job. If the current status doesn't allow completing the job,
 * you can update the status to `processing` using the endpoint POST /internal/patient/bulk/:id
 *
 * @param req.params.id The patient import job ID.
 * @param req.query.cxId The customer ID.
 * @param req.query.disableWebhooks Optional: Indicates whether send webhooks, applies to both
 *        the data pipeline and the bulk import webhooks.
 */
router.post(
  "/:id/done",
  requestLogger,
  asyncHandler(async (req: Request, res: Response) => {
    const cxId = getUUIDFrom("query", req, "cxId").orFail();
    const jobId = getFromParamsOrFail("id", req);
    const disableWebhooks = getFromQueryAsBoolean("disableWebhooks", req);
    capture.setExtra({ cxId, jobId });

    const job = await getPatientImportJobOrFail({ cxId, jobId });

    validateNewStatus(job.status, "completed");

    await updatePatientImportParams({ cxId, jobId, disableWebhooks });

    const next = buildPatientImportResult();
    await next.processJobResult({ cxId, jobId });

    return res.sendStatus(status.OK);
  })
);

/** ---------------------------------------------------------------------------
 * POST /internal/patient/bulk/:id
 *
 * Updates the status of a bulk patient import job. To be called by the parse lambda to
 * indicate the CSV file has been parsed and the job has been started or failed.
 *
 * @param req.params.id The patient import job ID.
 * @param req.query.cxId The customer ID.
 * @param req.body.status The new status of the job.
 * @param req.body.total The total number of patients in the job.
 * @param req.body.failed The number of patient entries that failed in the job.
 * @param req.body.forceStatusUpdate Optional: Indicates whether to bypass the job status validation (state machine).
 */
router.post(
  "/:id",
  requestLogger,
  asyncHandler(async (req: Request, res: Response) => {
    const cxId = getUUIDFrom("query", req, "cxId").orFail();
    const jobId = getFromParamsOrFail("id", req);
    const updateParams = updateJobSchema.parse(req.body);
    capture.setExtra({ cxId, jobId });

    const patientImport = await updatePatientImportTracking({
      jobId,
      cxId,
      status: updateParams.status,
      total: updateParams.total,
      failed: updateParams.failed,
      forceStatusUpdate: updateParams.forceStatusUpdate,
    });

    return res.status(status.OK).json(patientImport);
  })
);

const detailSchema = z.enum(["info", "debug"]).optional().default("info");

type PatientImportJobWithUrls = PatientImportJob & {
  validEntriesUrl: string;
  invalidEntriesUrl: string;
};

/** ---------------------------------------------------------------------------
 * GET /internal/patient/bulk
 *
 * Returns all bulk patient import jobs for a given customer. If a facilityId is provided,
 * only returns jobs for that facility. If no facilityId is provided, returns jobs for all
 * facilities for the customer.
 *
 * It'll also return the URLs for the valid and invalid entries files for each job. The URLs
 * are valid for 10 minutes.
 *
 * @param req.query.cxId The customer ID.
 * @param req.query.facilityId The facility ID. Optional.
 * @return The patient import job with valid/invalid entries URLs.
 */
router.get(
  "/",
  requestLogger,
  asyncHandler(async (req: Request, res: Response) => {
    const cxId = getUUIDFrom("query", req, "cxId").orFail();
    const facilityId = getFrom("query").optional("facilityId", req);

    const patientImports = await getPatientImportJobList({ cxId, facilityId });

    const s3Utils = new S3Utils(Config.getAWSRegion());
    const urlDuration = dayjs.duration(10, "minutes");

    const respWithUrls: PatientImportJobWithUrls[] = await Promise.all(
      patientImports.map(async job => {
        const validEntriesUrl = await s3Utils.getSignedUrl({
          bucketName: Config.getPatientImportBucket(),
          fileName: createFileKeyResults(cxId, job.id),
          durationSeconds: urlDuration.asSeconds(),
        });
        const invalidEntriesUrl = await s3Utils.getSignedUrl({
          bucketName: Config.getPatientImportBucket(),
          fileName: createFileKeyInvalid(cxId, job.id),
          durationSeconds: urlDuration.asSeconds(),
        });
        return { ...job, validEntriesUrl, invalidEntriesUrl };
      })
    );

    return res.status(status.OK).json(respWithUrls);
  })
);

/** ---------------------------------------------------------------------------
 * GET /internal/patient/bulk/:id
 *
 * Returns the job record for a given bulk patient import job.
 *
 * @param req.params.id The patient import job ID.
 * @param req.query.cxId The customer ID.
 * @param req.query.level Whether to include status detail FOR EACH PATIENT if the job if the
 *        job is `processing`, can be either `info` or `debug`. Optional, defaults to 'info'.
 * @return The patient import job.
 */
router.get(
  "/:id",
  requestLogger,
  asyncHandler(async (req: Request, res: Response) => {
    const cxId = getUUIDFrom("query", req, "cxId").orFail();
    const jobId = getFromParamsOrFail("id", req);
    const detail = detailSchema.parse(req.query.level);

    const patientImport = await getPatientImportJobOrFail({ cxId, jobId });

    if (patientImport.status === "processing" && detail === "debug") {
      const details: Record<string, string | number | null>[] = [];
      const resultEntries = await getResultEntries({
        cxId,
        jobId,
        patientImportBucket: Config.getPatientImportBucket(),
      });
      await executeAsynchronously(
        resultEntries,
        async entry => {
          if (entry.patientId) {
            const patient = await getPatientOrFail({ id: entry.patientId, cxId });
            const cqData = getCQData(patient.data.externalData);
            const cwData = getCWData(patient.data.externalData);
            details.push({
              patientId: patient.id,
              rowNumber: entry.rowNumber,
              status: entry.status,
              globalDownloadStatus: patient.data.documentQueryProgress?.download?.status ?? null,
              globalConvertStatus: patient.data.documentQueryProgress?.convert?.status ?? null,
              cqPqStatus: cqData?.discoveryStatus ?? null,
              cqDownloadStatus: cqData?.documentQueryProgress?.download?.status ?? null,
              cqConvertStatus: cqData?.documentQueryProgress?.convert?.status ?? null,
              cwPqStatus: cwData?.status ?? null,
              cwDownloadStatus: cwData?.documentQueryProgress?.download?.status ?? null,
              cwConvertStatus: cwData?.documentQueryProgress?.convert?.status ?? null,
            });
          } else {
            details.push({
              patientId: null,
              rowNumber: entry.rowNumber,
              status: entry.status,
            });
          }
        },
        { numberOfParallelExecutions: 5 }
      );
      const detailedResponse = {
        ...patientImport,
        details,
      };
      return res.status(status.OK).json(detailedResponse);
    }

    return res.status(status.OK).json(patientImport);
  })
);

/** ---------------------------------------------------------------------------
 * POST /internal/patient/bulk/:id/patient-mapping",
 *
 * Creates a patient import mapping for a patient.
 *
 * @param req.params.id The patient import job ID.
 * @param req.body.cxId The customer ID.
 * @param req.body.jobId The patient import job ID.
 * @param req.body.rowNumber The row number of the patient in the CSV file.
 * @param req.body.patientId The patient ID.
 * @param req.body.dataPipelineRequestId The data pipeline request ID.
 */
router.post(
  "/:id/patient-mapping",
  requestLogger,
  asyncHandler(async (req: Request, res: Response) => {
    const jobId = getFromParamsOrFail("id", req);
    const params = addPatientMappingSchema.parse(req.body);

    const createPatientImportMappingCmd: CreatePatientImportMappingCmd = { ...params, jobId };
    capture.setExtra(createPatientImportMappingCmd);

    const patientImport = await createPatientImportMapping(createPatientImportMappingCmd);

    return res.status(status.OK).json(patientImport);
  })
);

export default router;

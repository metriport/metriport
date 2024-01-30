import { BulkGetDocUrlStatus } from "@metriport/core/domain/bulk-get-document-url";
import {
  DocumentBulkSignerLambdaResponse,
  DocumentBulkSignerLambdaResponseArraySchema,
} from "@metriport/core/domain/document-bulk-signer-response";
import { convertResult } from "@metriport/core/domain/document-query";
import { createS3FileName, S3Utils } from "@metriport/core/external/aws/s3";
import { isMedicalDataSource } from "@metriport/core/external/index";
import { uuidv7 } from "@metriport/core/util/uuid-v7";
import { Request, Response } from "express";
import Router from "express-promise-router";
import httpStatus from "http-status";
import multer from "multer";
import { z } from "zod";
import {
  createAndUploadDocReference,
  updateDocumentReference,
} from "../../command/medical/admin/upload-doc";
import { checkDocumentQueries } from "../../command/medical/document/check-doc-queries";
import {
  isDocumentQueryProgressEqual,
  queryDocumentsAcrossHIEs,
  updateConversionProgress,
} from "../../command/medical/document/document-query";
import { reConvertDocuments } from "../../command/medical/document/document-reconvert";
import {
  MAPIWebhookStatus,
  processPatientDocumentRequest,
} from "../../command/medical/document/document-webhook";
import { appendDocQueryProgress } from "../../command/medical/patient/append-doc-query-progress";
import { appendBulkGetDocUrlProgress } from "../../command/medical/patient/bulk-get-doc-url-progress";
import { getPatientOrFail } from "../../command/medical/patient/get-patient";
import BadRequestError from "../../errors/bad-request";
import { parseJobId } from "../../external/fhir/connector/connector";
import { appendDocQueryProgressWithSource } from "../../external/hie/append-doc-query-progress-with-source";
import { updateSourceConversionProgress } from "../../external/hie/update-source-conversion-progress";
import { Config } from "../../shared/config";
import { parseISODate } from "../../shared/date";
import { errorToString } from "../../shared/log";
import { capture } from "../../shared/notifications";
import { Util } from "../../shared/util";
import { documentQueryProgressSchema } from "../schemas/internal";
import { getUUIDFrom } from "../schemas/uuid";
import { asyncHandler, getFrom, getFromQueryAsArray, getFromQueryAsBoolean } from "../util";
import { getFromQueryOrFail } from "./../util";
import { cxRequestMetadataSchema } from "./schemas/request-metadata";

const router = Router();
const upload = multer();
const region = Config.getAWSRegion();
const s3Utils = new S3Utils(region);
const bucketName = Config.getMedicalDocumentsBucketName();

/** ---------------------------------------------------------------------------
 * POST /internal/docs/re-convert
 *
 * WARNING: This will remove all non-DocumentReferences from the FHIR server!
 *
 * Use the document references we have on FHIR server and the respective CDA on S3
 * to re-convert them to FHIR and insert on the FHIR server.
 *
 * WARNING: This will remove all non-DocumentReferences from the FHIR server!
 *
 * Asychronous operation, returns 200 immediately.
 *
 * @param req.query.cxId - The customer's ID.
 * @param req.query.patientIds - Comma-separated list of Patient IDs to filter document
 *     references for;
 * @param req.query.documentIds - Optional comma-separated list of metriport document
 *     IDs to re-convert; if not set all documents of the customer will be re-converted;
 * @param req.query.dateFrom Start date that doc refs will be filtered by (inclusive, required).
 * @param req.query.dateTo Optional end date that doc refs will be filtered by (inclusive).
 * @param req.query.logConsolidatedCountBefore Optional whether to log consolidated data count
 *     before the re-conversion (defaults false).
 * @param req.query.isDisableWH Optional whether to disable sending WH notifications after the
 *     re-conversion is done (defaults true).
 * @param req.query.dryRun Optional whether just simulate the execution of the endpoint, no
 *     change is expected in the repositories (defaults false).
 * @return 200
 */
router.post(
  "/re-convert",
  asyncHandler(async (req: Request, res: Response) => {
    const cxId = getUUIDFrom("query", req, "cxId").orFail();
    const patientIds = getFromQueryAsArray("patientIds", req) ?? [];
    const documentIds = getFromQueryAsArray("documentIds", req) ?? [];
    const dateFrom = parseISODate(getFrom("query").orFail("dateFrom", req));
    const dateTo = parseISODate(getFrom("query").optional("dateTo", req));
    const isDisableWH = getFromQueryAsBoolean("isDisableWH", req);
    const dryRun = getFromQueryAsBoolean("dryRun", req);
    const logConsolidatedCountBefore = getFromQueryAsBoolean("logConsolidatedCountBefore", req);
    const requestId = uuidv7();

    reConvertDocuments({
      cxId,
      patientIds,
      documentIds,
      dateFrom,
      dateTo,
      requestId,
      isDisableWH,
      dryRun,
      logConsolidatedCountBefore,
    }).catch(err => {
      console.log(`Error re-converting documents for cxId ${cxId}: ${errorToString(err)}`);
      capture.error(err);
    });
    return res.status(httpStatus.OK).json({
      processing: true,
      cxId,
      patientIds,
      documentIds,
      dateFrom,
      dateTo,
      requestId,
      isDisableWH,
      dryRun,
    });
  })
);

const convertResultSchema = z.enum(convertResult);

/** ---------------------------------------------------------------------------
 * POST /internal/docs/conversion-status
 *
 * Called by FHIR conversion/upsert lambdas to indicate the job is completed or failed.
 */
router.post(
  "/conversion-status",
  asyncHandler(async (req: Request, res: Response) => {
    const patientId = getFrom("query").orFail("patientId", req);
    const cxId = getUUIDFrom("query", req, "cxId").orFail();
    const status = getFrom("query").orFail("status", req);
    const source = getFrom("query").optional("source", req);
    const details = getFrom("query").optional("details", req);
    const jobId = getFrom("query").optional("jobId", req);
    const convertResult = convertResultSchema.parse(status);
    const { log } = Util.out(`Doc conversion status - patient ${patientId}`);

    // keeping the old logic for now, but we should avoid having these optional parameters that can
    // lead to empty string or `undefined` being used as IDs
    const decomposed = jobId ? parseJobId(jobId) : { requestId: "", documentId: "" };
    const requestId = decomposed?.requestId ?? "";
    const docId = decomposed?.documentId ?? "";
    const hasSource = isMedicalDataSource(source);

    log(`Converted document ${docId} with status ${convertResult}, details: ${details}`);

    const patient = await getPatientOrFail({ id: patientId, cxId });
    const docQueryProgress = patient.data.documentQueryProgress;
    log(`Status pre-update: ${JSON.stringify(docQueryProgress)}`);

    if (hasSource) {
      const updatedSourceDocProgress = updateSourceConversionProgress({
        patient: patient,
        convertResult,
        source: source,
      });

      appendDocQueryProgressWithSource({
        patient: patient,
        convertProgress: updatedSourceDocProgress,
        requestId,
        source,
      });
    } else {
      let expectedPatient = await updateConversionProgress({
        patient: { id: patientId, cxId },
        convertResult,
      });

      // START TODO 785 remove this once we're confident with the flow
      const maxAttempts = 3;
      let curAttempt = 1;
      let verifiedSuccess = false;
      while (curAttempt++ < maxAttempts) {
        const patientPost = await getPatientOrFail({ id: patientId, cxId });
        const postDocQueryProgress = patientPost.data.documentQueryProgress;
        log(`[attempt ${curAttempt}] Status post-update: ${JSON.stringify(postDocQueryProgress)}`);
        if (
          !isDocumentQueryProgressEqual(
            expectedPatient.data.documentQueryProgress,
            postDocQueryProgress
          )
        ) {
          log(`[attempt ${curAttempt}] Status post-update not expected... trying to update again`);
          expectedPatient = await updateConversionProgress({
            patient: { id: patientId, cxId },
            convertResult,
          });
        } else {
          log(`[attempt ${curAttempt}] Status post-update is as expected!`);
          verifiedSuccess = true;
          break;
        }
      }
      if (!verifiedSuccess) {
        const patientPost = await getPatientOrFail({ id: patientId, cxId });
        log(`final Status post-update: ${JSON.stringify(patientPost.data.documentQueryProgress)}`);
      }
      // END TODO 785

      const conversionStatus = expectedPatient.data.documentQueryProgress?.convert?.status;
      if (conversionStatus === "completed") {
        processPatientDocumentRequest(
          cxId,
          patientId,
          "medical.document-conversion",
          MAPIWebhookStatus.completed,
          ""
        );
      }
    }

    return res.sendStatus(httpStatus.OK);
  })
);

/**
 * Overrides the document query progress for the given patient ID.
 */
router.post(
  "/override-progress",
  asyncHandler(async (req: Request, res: Response) => {
    const cxId = getUUIDFrom("query", req, "cxId").orFail();
    const patientId = getFrom("query").orFail("patientId", req);
    const docQueryProgressRaw = req.body;
    const docQueryProgress = documentQueryProgressSchema.parse(docQueryProgressRaw);
    const downloadProgress = docQueryProgress.download;
    const convertProgress = docQueryProgress.convert;

    if (!downloadProgress && !convertProgress) {
      throw new BadRequestError(`Require at least one of 'download' or 'convert'`);
    }
    const patient = await getPatientOrFail({ cxId, id: patientId });

    const updatedPatient = await appendDocQueryProgress({
      patient: { id: patientId, cxId },
      downloadProgress,
      convertProgress,
      requestId: patient.data.documentQueryProgress?.requestId ?? "",
    });

    return res.json(updatedPatient.data.documentQueryProgress);
  })
);

/**
 * Trigger a check of the document queries for the given patient IDs, or all patients if none
 * are specified.
 */
router.post(
  "/check-doc-queries",
  asyncHandler(async (req: Request, res: Response) => {
    const patientIds = getFromQueryAsArray("patientIds", req) ?? [];
    checkDocumentQueries(patientIds);
    return res.sendStatus(httpStatus.ACCEPTED);
  })
);

const documentDataSchema = z.object({
  mimeType: z.string().optional(),
  size: z.number().optional(),
  originalName: z.string(),
  locationUrl: z.string(),
  docId: z.string(),
});

const uploadDocSchema = z.object({
  description: z.string().optional(),
  orgName: z.string().optional(),
  practitionerName: z.string().optional(),
});

/** ---------------------------------------------------------------------------
 * POST /internal/docs/upload
 *
 * Upload doc for a patient.
 *
 * Originally on packages/api/src/routes/internal.ts
 *
 * @param req.query.cxId - The customer/account's ID.
 * @param req.query.patientId - The patient ID.
 * @param req.file - The file to be stored.
 * @param req.body.description - The description of the file.
 * @param req.body.orgName - The name of the contained Organization
 * @param req.body.practitionerName - The name of the contained Practitioner
 *
 * @return 200 Indicating the file was successfully uploaded.
 */
router.post(
  "/upload",
  upload.single("file"),
  asyncHandler(async (req: Request, res: Response) => {
    const cxId = getUUIDFrom("query", req, "cxId").orFail();
    const patientId = getUUIDFrom("query", req, "patientId").orFail();
    const file = req.file;

    if (!file) {
      throw new BadRequestError("File must be provided");
    }

    const docRefId = uuidv7();
    const fileName = createS3FileName(cxId, patientId, docRefId);

    await s3Utils.s3
      .upload({
        Bucket: bucketName,
        Key: fileName,
        Body: file.buffer,
        ContentType: file.mimetype,
      })
      .promise();

    const metadata = uploadDocSchema.parse({
      description: req.body.description,
      orgName: req.body.orgName,
      practitionerName: req.body.practitionerName,
    });

    const docRef = await createAndUploadDocReference({
      cxId,
      patientId,
      docId: docRefId,
      file: {
        ...file,
        originalname: fileName,
      },
      metadata,
    });

    return res.status(httpStatus.OK).json(docRef);
  })
);

/** ---------------------------------------------------------------------------
 * POST /internal/docs/doc-ref
 *
 * Update the doc ref for a medical document uploaded by a cx.
 * @param req.query.cxId - The customer/account's ID.
 *
 * @return 201 Indicating the DocRef was successfully updated.
 */
router.post(
  "/doc-ref",
  asyncHandler(async (req: Request, res: Response) => {
    console.log("Updating the DocRef on a CX-uploaded file...");
    const cxId = getFromQueryOrFail("cxId", req);

    const fileData = documentDataSchema.parse(req.body);

    const docRef = await updateDocumentReference({
      cxId,
      fileData,
    });

    return res.status(httpStatus.OK).json(docRef);
  })
);

/** ---------------------------------------------------------------------------
 * GET /internal/docs/query
 *
 * Returns the document query status for the specified patient.
 *
 * @param req.query.cxId - The customer/account's ID.
 * @param req.query.patientId Patient ID for which to retrieve document query status.
 * @return The status of document querying across HIEs.
 */
router.get(
  "/query",
  asyncHandler(async (req: Request, res: Response) => {
    const cxId = getUUIDFrom("query", req, "cxId").orFail();
    const patientId = getUUIDFrom("query", req, "patientId").orFail();
    const patient = await getPatientOrFail({ cxId, id: patientId });
    return res.status(httpStatus.OK).json({
      documentQueryProgress: patient.data.documentQueryProgress,
    });
  })
);

/**
 * POST /internal/docs/query
 *
 * Starts a new document query even if the current one is in 'processing' state.
 * @param req.query.cxId - The customer/account's ID.
 * @param req.query.patientId - The customer/account's ID.
 * @param req.query.facilityId - Optional; The facility providing NPI for the document query.
 * @param req.body Optional metadata to be sent through webhook. {"disableWHFlag": "true"} can be sent here to disable webhook.
 * @return updated document query progress
 */
router.post(
  "/query",
  asyncHandler(async (req: Request, res: Response) => {
    const cxId = getFrom("query").orFail("cxId", req);
    const patientId = getFrom("query").orFail("patientId", req);
    const facilityId = getFrom("query").optional("facilityId", req);
    const cxDocumentRequestMetadata = cxRequestMetadataSchema.parse(req.body);

    const docQueryProgress = await queryDocumentsAcrossHIEs({
      cxId,
      patientId,
      facilityId,
      forceQuery: true,
      cxDocumentRequestMetadata: cxDocumentRequestMetadata?.metadata,
    });

    return res.status(httpStatus.OK).json(docQueryProgress);
  })
);

export default router;

/**
 * POST /internal/docs/triggerBulkDownloadWebhook
 *
 * Endpoint called by the bulk signer lambda to trigger the webhook.
 * @param req.query.cxId - The customer/account's ID.
 * @param req.query.patientId - The patient's ID.
 * @param req.query.requestId - The ID of the request.
 * @param req.body The DocumentBulkSignerLambdaResponse object.
 * @return Updated bulk download query progress.
 */
router.post(
  "/triggerBulkDownloadWebhook",
  asyncHandler(async (req: Request, res: Response) => {
    const cxId = getFrom("query").orFail("cxId", req);
    const patientId = getFrom("query").orFail("patientId", req);
    const requestId = getFrom("query").orFail("requestId", req);
    const status = getFrom("query").orFail("status", req);
    const dtos: DocumentBulkSignerLambdaResponse[] =
      DocumentBulkSignerLambdaResponseArraySchema.parse(req.body);

    const updatedPatient = await appendBulkGetDocUrlProgress({
      patient: { id: patientId, cxId },
      status: status as BulkGetDocUrlStatus,
      requestId: requestId,
    });

    // trigger the webhook
    processPatientDocumentRequest(
      cxId,
      patientId,
      "medical.document-bulk-download-urls",
      status as MAPIWebhookStatus,
      requestId,
      dtos
    );

    return res.status(httpStatus.OK).json(updatedPatient.data.bulkGetDocumentsUrlProgress);
  })
);

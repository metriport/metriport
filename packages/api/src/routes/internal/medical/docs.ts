import { BulkGetDocUrlStatus } from "@metriport/core/domain/bulk-get-document-url";
import { convertResult } from "@metriport/core/domain/document-query";
import { createDocumentFilePath } from "@metriport/core/domain/document/filename";
import { parseJobId } from "@metriport/core/domain/job";
import { documentBulkSignerLambdaResponseArraySchema } from "@metriport/core/external/aws/document-signing/document-bulk-signer-response";
import { S3Utils } from "@metriport/core/external/aws/s3";
import { toFHIR as toFhirOrganization } from "@metriport/core/external/fhir/organization/conversion";
import { isMedicalDataSource } from "@metriport/core/external/index";
import { uuidv7 } from "@metriport/core/util/uuid-v7";
import { BadRequestError } from "@metriport/shared";
import { Request, Response } from "express";
import Router from "express-promise-router";
import httpStatus from "http-status";
import multer from "multer";
import { z } from "zod";
import {
  createAndUploadDocReference,
  updateDocumentReference,
} from "../../../command/medical/admin/upload-doc";
import { checkDocumentQueries } from "../../../command/medical/document/check-doc-queries";
import { calculateDocumentConversionStatus } from "../../../command/medical/document/document-conversion-status";
import { queryDocumentsAcrossHIEs } from "../../../command/medical/document/document-query";
import { reConvertDocuments } from "../../../command/medical/document/document-reconvert";
import {
  MAPIWebhookStatus,
  processPatientDocumentRequest,
} from "../../../command/medical/document/document-webhook";
import { startBulkGetDocumentUrls } from "../../../command/medical/document/start-bulk-get-doc-url";
import { getOrganizationOrFail } from "../../../command/medical/organization/get-organization";
import { appendDocQueryProgress } from "../../../command/medical/patient/append-doc-query-progress";
import { appendBulkGetDocUrlProgress } from "../../../command/medical/patient/bulk-get-doc-url-progress";
import { getPatientOrFail } from "../../../command/medical/patient/get-patient";
import {
  processCcdRequest,
  processEmptyCcdRequest,
} from "../../../external/cda/process-ccd-request";
import { setDocQueryProgress } from "../../../external/hie/set-doc-query-progress";
import { Config } from "../../../shared/config";
import { parseISODate } from "../../../shared/date";
import { errorToString } from "../../../shared/log";
import { capture } from "../../../shared/notifications";
import { requestLogger } from "../../helpers/request-logger";
import { toDTO } from "../../medical/dtos/document-bulk-downloadDTO";
import { cxRequestMetadataSchema } from "../../medical/schemas/request-metadata";
import { documentQueryProgressSchema } from "../../schemas/internal";
import { getUUIDFrom } from "../../schemas/uuid";
import {
  asyncHandler,
  getFrom,
  getFromQueryAsArray,
  getFromQueryAsBoolean,
  getFromQueryOrFail,
} from "../../util";
import { getFacilityIdOrFail } from "../../../domain/medical/patient-facility";

const router = Router();
const upload = multer();
const region = Config.getAWSRegion();
const s3Utils = new S3Utils(region);
const bucketName = Config.getMedicalDocumentsBucketName();
const requestIdEmptyOverride = "empty-override";

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
  requestLogger,
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
  requestLogger,
  asyncHandler(async (req: Request, res: Response) => {
    const patientId = getFrom("query").orFail("patientId", req);
    const cxId = getUUIDFrom("query", req, "cxId").orFail();
    const status = getFrom("query").orFail("status", req);
    const source = getFrom("query").orFail("source", req);
    const details = getFrom("query").optional("details", req);
    const jobId = getFrom("query").optional("jobId", req);
    const countRaw = getFrom("query").optional("count", req);
    const count = countRaw ? parseInt(countRaw) : undefined;
    const convertResult = convertResultSchema.parse(status);

    // keeping the old logic for now, but we should avoid having these optional parameters that can
    // lead to empty string or `undefined` being used as IDs
    const decomposed = jobId ? parseJobId(jobId) : { requestId: "", documentId: "" };
    const requestId = decomposed?.requestId ?? requestIdEmptyOverride;
    const docId = decomposed?.documentId ?? "";

    await calculateDocumentConversionStatus({
      patientId,
      cxId,
      requestId,
      docId,
      source,
      convertResult,
      details,
      count,
    });

    return res.sendStatus(httpStatus.OK);
  })
);

/**
 * Overrides the document query progress for the given patient ID.
 */
router.post(
  "/override-progress",
  requestLogger,
  asyncHandler(async (req: Request, res: Response) => {
    const cxId = getUUIDFrom("query", req, "cxId").orFail();
    const patientId = getFrom("query").orFail("patientId", req);
    const hie = getFrom("query").optional("hie", req);
    const docQueryProgressRaw = req.body;
    const docQueryProgress = documentQueryProgressSchema.parse(docQueryProgressRaw);
    const downloadProgress = docQueryProgress.download;
    const convertProgress = docQueryProgress.convert;
    const hasSource = isMedicalDataSource(hie);

    if (!downloadProgress && !convertProgress) {
      throw new BadRequestError(`Require at least one of 'download' or 'convert'`);
    }
    const patient = await getPatientOrFail({ cxId, id: patientId });

    const updatedPatient = await appendDocQueryProgress({
      patient: { id: patientId, cxId },
      downloadProgress,
      convertProgress,
      requestId: patient.data.documentQueryProgress?.requestId ?? requestIdEmptyOverride,
    });

    if (hasSource) {
      await setDocQueryProgress({
        patient: { id: patientId, cxId },
        requestId: updatedPatient.data.documentQueryProgress?.requestId ?? requestIdEmptyOverride,
        downloadProgress,
        convertProgress,
        source: hie,
      });
    }

    return res.json(updatedPatient.data.documentQueryProgress);
  })
);

/**
 * Trigger a check of the document queries for the given patient IDs, or all patients if none
 * are specified.
 */
router.post(
  "/check-doc-queries",
  requestLogger,
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
  requestLogger,
  asyncHandler(async (req: Request, res: Response) => {
    const cxId = getUUIDFrom("query", req, "cxId").orFail();
    const patientId = getUUIDFrom("query", req, "patientId").orFail();
    const file = req.file;

    if (!file) {
      throw new BadRequestError("File must be provided");
    }
    const metadata = uploadDocSchema.parse({
      description: req.body.description,
      orgName: req.body.orgName,
      practitionerName: req.body.practitionerName,
    });

    const docRefId = uuidv7();
    const fileName = createDocumentFilePath(cxId, patientId, docRefId, file.mimetype);

    const uploadRes = await s3Utils.s3
      .upload({
        Bucket: bucketName,
        Key: fileName,
        Body: file.buffer,
        ContentType: file.mimetype,
      })
      .promise();

    const docRef = await createAndUploadDocReference({
      cxId,
      patientId,
      docId: docRefId,
      file: {
        ...file,
        originalname: fileName,
      },
      location: uploadRes.Location,
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
  requestLogger,
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
  requestLogger,
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
 * Starts a new document query. Optionally overrides even if the current one is in 'processing' state.
 * @param req.query.cxId - The customer/account's ID.
 * @param req.query.patientId - The customer/account's ID.
 * @param req.query.facilityId - Optional; The facility providing NPI for the document query.
 * @param req.query.requestId - Optional; The request ID for the document query.
 * @param req.body Optional metadata to be sent through webhook. {"disableWHFlag": "true"} can be sent here to disable webhook.
 * @param req.query.forceDownload - Optional; Whether to forceDownload files already downloaded. Defaults to false.
 * @param req.query.forceQuery - Optional; Whether to force doc query to run. DEFAULTS TRUE.
 * @param req.query.forcePatientDiscovery - Optional; Whether to force patient discovery before document query.
 * @param req.query.cqManagingOrgName - Optional; The CQ managing organization name.
 * @param req.query.triggerConsolidated - Optional; Whether to force get consolidated PDF on conversion finish.
 * @return updated document query progress
 */
router.post(
  "/query",
  requestLogger,
  asyncHandler(async (req: Request, res: Response) => {
    const cxId = getFrom("query").orFail("cxId", req);
    const patientId = getFrom("query").orFail("patientId", req);
    const facilityIdParam = getFrom("query").optional("facilityId", req);
    const requestId = getFrom("query").optional("requestId", req);
    const forceDownload = getFromQueryAsBoolean("forceDownload", req) ?? false;
    const forceQuery = getFromQueryAsBoolean("forceQuery", req) ?? true;
    const forcePatientDiscovery = getFromQueryAsBoolean("forcePatientDiscovery", req);
    const cqManagingOrgName = getFrom("query").optional("cqManagingOrgName", req);
    const triggerConsolidated = getFromQueryAsBoolean("triggerConsolidated", req);
    const cxDocumentRequestMetadata = cxRequestMetadataSchema.parse(req.body);

    const patient = await getPatientOrFail({ cxId, id: patientId });
    const facilityId = getFacilityIdOrFail(patient, facilityIdParam);

    const docQueryProgress = await queryDocumentsAcrossHIEs({
      cxId,
      patientId,
      facilityId,
      requestId,
      forceDownload,
      forceQuery,
      forcePatientDiscovery,
      cqManagingOrgName,
      triggerConsolidated,
      cxDocumentRequestMetadata: cxDocumentRequestMetadata?.metadata,
    });

    return res.status(httpStatus.OK).json(docQueryProgress);
  })
);

/**
 * POST /internal/docs/download-url/bulk/continue
 *
 * Continues the existing bulk download request.
 * @param req.query.cxId - The customer/account's ID.
 * @param req.query.patientId - The patient's ID.
 * @param req.body The metadata for the bulk download request.
 * @returns The status of the bulk signing process.
 * @throws 400 if no processing request is found for the patient.
 */
router.post(
  "/download-url/bulk/continue",
  requestLogger,
  asyncHandler(async (req: Request, res: Response) => {
    const cxId = getFrom("query").orFail("cxId", req);
    const patientId = getFrom("query").orFail("patientId", req);
    const cxDownloadRequestMetadata = cxRequestMetadataSchema.parse(req.body);

    const bulkGetDocumentsUrlProgress = await startBulkGetDocumentUrls({
      cxId,
      patientId,
      cxDownloadRequestMetadata: cxDownloadRequestMetadata?.metadata,
      continueProcessingRequest: true,
    });

    return res.status(httpStatus.OK).json(bulkGetDocumentsUrlProgress);
  })
);

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
  requestLogger,
  asyncHandler(async (req: Request, res: Response) => {
    const cxId = getFrom("query").orFail("cxId", req);
    const patientId = getFrom("query").orFail("patientId", req);
    const requestId = getFrom("query").orFail("requestId", req);
    const status = getFrom("query").orFail("status", req);
    const docs = documentBulkSignerLambdaResponseArraySchema.parse(req.body);

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
      toDTO(docs)
    );

    return res.status(httpStatus.OK).json(updatedPatient.data.bulkGetDocumentsUrlProgress);
  })
);

/**
 * POST /internal/docs/ccd
 *
 * Generates a CCD document and uploads it for the specified patient.
 * @param req.query.cxId - The customer/account's ID.
 * @param req.query.patientId - The patient's ID.
 * @return The CCD document string in XML format.
 */
router.post(
  "/ccd",
  requestLogger,
  asyncHandler(async (req: Request, res: Response) => {
    const cxId = getFrom("query").orFail("cxId", req);
    const patientId = getFrom("query").orFail("patientId", req);
    const patient = await getPatientOrFail({ cxId, id: patientId });
    const ccd = await processCcdRequest({ patient });
    return res.type("application/xml").status(httpStatus.OK).send(ccd);
  })
);

/**
 * POST /internal/docs/empty-ccd
 *
 * Generates an empty CCD document and uploads it for the specified patient.
 * @param req.query.cxId - The customer/account's ID.
 * @param req.query.patientId - The patient's ID.
 * @return The CCD document string in XML format.
 */
router.post(
  "/empty-ccd",
  requestLogger,
  asyncHandler(async (req: Request, res: Response) => {
    const cxId = getFrom("query").orFail("cxId", req);
    const patientId = getFrom("query").orFail("patientId", req);
    const [patient, organization] = await Promise.all([
      getPatientOrFail({ cxId, id: patientId }),
      getOrganizationOrFail({ cxId }),
    ]);

    const fhirOrganization = toFhirOrganization(organization);
    const ccd = await processEmptyCcdRequest(patient, fhirOrganization);
    return res.type("application/xml").status(httpStatus.OK).send(ccd);
  })
);

export default router;

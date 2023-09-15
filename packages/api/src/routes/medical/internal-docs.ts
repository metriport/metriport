import { Request, Response } from "express";
import Router from "express-promise-router";
import httpStatus from "http-status";
import multer from "multer";
import { z } from "zod";
import { createAndUploadDocReference } from "../../command/medical/admin/upload-doc";
import { checkDocumentQueries } from "../../command/medical/document/check-doc-queries";
import {
  isDocumentQueryProgressEqual,
  updateDocQuery,
} from "../../command/medical/document/document-query";
import { options, reprocessDocuments } from "../../command/medical/document/document-redownload";
import {
  MAPIWebhookStatus,
  processPatientDocumentRequest,
} from "../../command/medical/document/document-webhook";
import { getPatientOrFail } from "../../command/medical/patient/get-patient";
import { convertResult } from "../../domain/medical/document-query";
import BadRequestError from "../../errors/bad-request";
import { makeS3Client } from "../../external/aws/s3";
import { Config } from "../../shared/config";
import { createS3FileName } from "../../shared/external";
import { capture } from "../../shared/notifications";
import { Util } from "../../shared/util";
import { uuidv7 } from "../../shared/uuid-v7";
import { documentQueryProgressSchema } from "../schemas/internal";
import { stringListSchema } from "../schemas/shared";
import { getUUIDFrom } from "../schemas/uuid";
import { asyncHandler, getFrom } from "../util";
import { getFromQueryOrFail } from "./../util";

const router = Router();
const upload = multer();
const s3client = makeS3Client();
const bucketName = Config.getMedicalDocumentsBucketName();

const reprocessOptionsSchema = z.enum(options).array().optional();

/** ---------------------------------------------------------------------------
 * POST /internal/docs/reprocess
 *
 * Use the document reference we have on FHIR server to:
 * - re-download the Binary and update it on S3 (if override = true);
 * - re-convert it to FHIR (when applicable);
 * - update the FHIR server with the results.
 *
 * Asychronous operation, returns 200 immediately.
 *
 * @param req.query.cxId - The customer/account's ID.
 * @param req.query.documentIds - Optional comma-separated list of metriport document
 *     IDs to re-download; if not set all documents of the customer will be re-downloaded;
 * @param req.query.options - Optional, array with elements being one of:
 *     - re-query-doc-refs: indicates we should re-query the document references, if not present
 *       the API will use the existing doc refs on the FHIR server;
 *     - force-download: whether we should re-download the documents from CommonWell, if not
 *       present the API will not download them again if already present on S3.
 * @return 200
 */
router.post(
  "/reprocess",
  asyncHandler(async (req: Request, res: Response) => {
    const cxId = getUUIDFrom("query", req, "cxId").orFail();
    const documentIdsRaw = getFrom("query").optional("documentIds", req);
    const documentIds = documentIdsRaw
      ? stringListSchema.parse(documentIdsRaw.split(",").map(id => id.trim()))
      : [];
    const optionsRaw = getFrom("query").optional("options", req);
    const options = optionsRaw
      ? reprocessOptionsSchema.parse(optionsRaw.split(",").map(id => id.trim()))
      : [];
    const requestId = uuidv7();

    reprocessDocuments({ cxId, documentIds, options, requestId }).catch(err => {
      console.log(`Error re-processing documents for cxId ${cxId}: `, err);
      capture.error(err);
    });
    return res.json({ processing: true, options, documentIds, cxId });
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
    const docId = getFrom("query").optional("jobId", req);
    const convertResult = convertResultSchema.parse(status);
    const { log } = Util.out(`Doc conversion status - patient ${patientId}`);

    log(`Converted document ${docId} with status ${convertResult}`);

    // START TODO 785 remove this once we're confident with the flow
    const patientPre = await getPatientOrFail({ id: patientId, cxId });
    const docQueryProgress = patientPre.data.documentQueryProgress;
    log(`Status pre-update: ${JSON.stringify(docQueryProgress)}`);
    // END TODO 785

    let expectedPatient = await updateDocQuery({
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
        expectedPatient = await updateDocQuery({
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
        MAPIWebhookStatus.completed
      );
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
    const updatedPatient = await updateDocQuery({
      patient: { id: patientId, cxId },
      downloadProgress,
      convertProgress,
      requestId: patient.data.documentQueryProgress?.requestId,
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
    const patientIdsRaw = getFrom("query").optional("patientIds", req);
    const patientIds = patientIdsRaw?.split(",") ?? [];
    checkDocumentQueries(patientIds);
    return res.sendStatus(httpStatus.ACCEPTED);
  })
);

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
    const patientId = getFromQueryOrFail("patientId", req);
    const file = req.file;

    if (!file) {
      throw new BadRequestError("File must be provided");
    }

    const docRefId = uuidv7();
    const fileName = createS3FileName(cxId, patientId, docRefId);

    await s3client
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

export default router;

import { S3Utils, createS3FileName } from "@metriport/core/external/aws/s3";
import { UploadDocumentResult } from "@metriport/api-sdk";
import { uuidv7 } from "@metriport/core/util/uuid-v7";
import { Request, Response } from "express";
import Router from "express-promise-router";
import httpStatus, { OK } from "http-status";
import { z } from "zod";
import { downloadDocument } from "../../command/medical/document/document-download";
import { startBulkGetDocumentUrls } from "../../command/medical/document/start-bulk-get-doc-url";
import { queryDocumentsAcrossHIEs } from "../../command/medical/document/document-query";
import { getOrganizationOrFail } from "../../command/medical/organization/get-organization";
import { getPatientOrFail } from "../../command/medical/patient/get-patient";
import ForbiddenError from "../../errors/forbidden";
import {
  composeDocumentReference,
  docRefCheck,
} from "../../external/fhir/document/draft-update-document-reference";
import { upsertDocumentToFHIRServer } from "../../external/fhir/document/save-document-reference";
import { searchDocuments } from "../../external/fhir/document/search-documents";
import { Config } from "../../shared/config";
import { stringToBoolean } from "@metriport/shared";
import { sanitize } from "../helpers/string";
import { optionalDateSchema } from "../schemas/date";
import { asyncHandler, getCxIdOrFail, getFrom, getFromQueryOrFail } from "../util";
import { toDTO } from "./dtos/documentDTO";
import { docConversionTypeSchema, docFileNameSchema } from "./schemas/documents";

import { cxRequestMetadataSchema } from "./schemas/request-metadata";

const router = Router();
const region = Config.getAWSRegion();
const s3Utils = new S3Utils(region);
const medicalDocumentsUploadBucketName = Config.getMedicalDocumentsUploadBucketName();

const getDocSchema = z.object({
  dateFrom: optionalDateSchema,
  dateTo: optionalDateSchema,
  content: z.string().min(3).nullish(),
  output: z.enum(["fhir", "dto"]).nullish(),
});

/** ---------------------------------------------------------------------------
 * GET /document
 *
 * Lists all Documents that can be retrieved for a Patient.
 *
 * @param req.query.patientId Patient ID for which to list documents.
 * @param req.query.dateFrom Optional start date that docs will be filtered by (inclusive).
 * @param req.query.dateTo Optional end date that docs will be filtered by (inclusive).
 * @param req.query.organization Optional name of the contained Organization to filter docs
 *    by (partial match and case insentitive).
 * @param req.query.content Optional value to search on the document reference
 *    (partial match and case insentitive, minimum 3 chars).
 * @param req.query.output Optional value indicating the output format, fhir or dto.
 *    (default: fhir)
 * @return The available documents, including query status and progress - as applicable.
 */
router.get(
  "/",
  asyncHandler(async (req: Request, res: Response) => {
    const cxId = getCxIdOrFail(req);
    const patientId = getFromQueryOrFail("patientId", req);
    const { dateFrom, dateTo, content, output } = getDocSchema.parse(req.query);

    // Confirm the CX can access this patient
    await getPatientOrFail({ cxId, id: patientId });

    const documents = await searchDocuments({
      cxId,
      patientId,
      dateRange: { from: dateFrom ?? undefined, to: dateTo ?? undefined },
      contentFilter: content ? sanitize(content) : undefined,
    });

    return res.status(OK).json({ documents: output === "dto" ? toDTO(documents) : documents });
  })
);

/** ---------------------------------------------------------------------------
 * GET /document/query
 *
 * Returns the document query status for the specified patient.
 *
 * @param req.query.patientId Patient ID for which to retrieve document query status.
 * @return The status of document querying across HIEs.
 */
router.get(
  "/query",
  asyncHandler(async (req: Request, res: Response) => {
    const cxId = getCxIdOrFail(req);
    const patientId = getFromQueryOrFail("patientId", req);
    const patient = await getPatientOrFail({ cxId, id: patientId });
    return res.status(OK).json(patient.data.documentQueryProgress ?? {});
  })
);

/** ---------------------------------------------------------------------------
 * POST /document/query
 *
 * Triggers a document query for the specified patient across HIEs.
 *
 * @param req.query.patientId Patient ID for which to retrieve document metadata.
 * @param req.query.facilityId The facility providing NPI for the document query.
 * @param req.query.override Whether to override files already downloaded (optional, defaults to false).
 * @param req.body Optional metadata to be sent through Webhook.
 * @return The status of document querying.
 */
router.post(
  "/query",
  asyncHandler(async (req: Request, res: Response) => {
    const cxId = getCxIdOrFail(req);
    const patientId = getFromQueryOrFail("patientId", req);
    const facilityId = getFrom("query").optional("facilityId", req);
    const override = stringToBoolean(getFrom("query").optional("override", req));
    const cxDocumentRequestMetadata = cxRequestMetadataSchema.parse(req.body);

    const docQueryProgress = await queryDocumentsAcrossHIEs({
      cxId,
      patientId,
      facilityId,
      override,
      cxDocumentRequestMetadata: cxDocumentRequestMetadata?.metadata,
    });

    return res.status(OK).json(docQueryProgress);
  })
);

/**
 * Handles the logic for download url endpoints.
 *
 * @param req Request object.
 * @returns URL for downloading the document.
 */
async function getDownloadUrl(req: Request): Promise<string> {
  const cxId = getCxIdOrFail(req);

  const fileName = getFromQueryOrFail("fileName", req);
  const fileNameString = docFileNameSchema.parse(fileName);
  const fileHasCxId = fileNameString.includes(cxId);
  const type = getFrom("query").optional("conversionType", req);
  const conversionType = type ? docConversionTypeSchema.parse(type) : undefined;

  if (!fileHasCxId && !Config.isSandbox()) {
    const message = "File name is invalid or does not contain the CX ID";
    console.log(`${message}: ${fileName}, ${cxId}`);
    throw new ForbiddenError(message);
  }

  const url = await downloadDocument({ fileName, conversionType });
  return url;
}

// TODO: Redirect this endpoint to the new one (download-url)
/** ---------------------------------------------------------------------------
 * GET /document/downloadUrl
 * Fetches the document from S3 and sends a presigned URL
 * @deprecated Use the GET /download-url endpoint instead.
 *
 * @param req.query.fileName The file name of the document in s3.
 * @param req.query.conversionType The doc type to convert to.
 * @return presigned url
 */
router.get(
  "/downloadUrl",
  asyncHandler(async (req: Request, res: Response) => {
    const url = await getDownloadUrl(req);
    return res.status(OK).json({ url });
  })
);

/** ---------------------------------------------------------------------------
 * GET /document/download-url
 *
 * Fetches the document from S3 and sends a presigned URL
 *
 * @param req.query.fileName The file name of the document in s3.
 * @param req.query.conversionType The doc type to convert to.
 * @return presigned url
 */
router.get(
  "/download-url",
  asyncHandler(async (req: Request, res: Response) => {
    const url = await getDownloadUrl(req);
    return res.status(OK).json({ url });
  })
);

/** ---------------------------------------------------------------------------
 * POST /document/download-url/bulk
 *
 * Triggers a wh payload containing the list of downloadable urls  for all the patients documents.
 * Returns the status of the bulk signing process.
 *
 * @param req.query.patientId Patient ID for which to retrieve document metadata.
 * @returns The status of the bulk signing process
 */

router.post(
  "/download-url/bulk",
  asyncHandler(async (req: Request, res: Response) => {
    const cxId = getCxIdOrFail(req);
    const patientId = getFromQueryOrFail("patientId", req);
    const BulkGetDocumentsUrlProgress = await startBulkGetDocumentUrls(cxId, patientId);
    return res.status(OK).json(BulkGetDocumentsUrlProgress);
  })
);

async function getUploadUrlAndCreateDocRef(req: Request): Promise<UploadDocumentResult> {
  const cxId = getCxIdOrFail(req);
  const patientId = getFromQueryOrFail("patientId", req);
  const docId = uuidv7();
  const s3FileName = createS3FileName(cxId, patientId, docId);
  const organization = await getOrganizationOrFail({ cxId });

  const docRefDraft = req.body;
  docRefCheck(docRefDraft);
  // #1075 TODO: Validate FHIR Payloads

  const docRef = composeDocumentReference(
    docRefDraft,
    organization,
    patientId,
    docId,
    s3FileName,
    medicalDocumentsUploadBucketName
  );

  const url = await s3Utils.getPresignedUploadUrl({
    bucket: medicalDocumentsUploadBucketName,
    key: s3FileName,
  });

  // Make a temporary DocumentReference on the FHIR server.
  console.log("Creating a temporary DocumentReference on the FHIR server with ID:", docRef.id);
  await upsertDocumentToFHIRServer(cxId, docRef);

  return { documentReferenceId: docId, uploadUrl: url };
}

/**
 * @deprecated - use POST /document/upload instead.
 * POST /document/upload-url
 *
 * Uploads a medical document and creates a Document Reference for that file on the FHIR server.
 *
 * @param patientId - The ID of the patient.
 * @body - The DocumentReference with context for the file to be uploaded.
 *
 * @return The URL string for document upload.
 * Refer to Metriport Documentation for more details:
 * https://docs.metriport.com/medical-api/api-reference/document/post-upload-url
 */
router.post(
  "/upload-url",
  asyncHandler(async (req: Request, res: Response) => {
    const resp = await getUploadUrlAndCreateDocRef(req);
    const url = resp.uploadUrl;
    return res.status(httpStatus.OK).json(url);
  })
);

/**
 * POST /document/upload
 *
 * Uploads a medical document and creates a Document Reference for that file on the FHIR server.
 *
 * @param patientId - The ID of the patient.
 * @body - The DocumentReference with context for the file to be uploaded.
 *
 * @return The DocumentReference ID and the URL for document upload.
 * Refer to Metriport Documentation for more details:
 * https://docs.metriport.com/medical-api/api-reference/document/post-upload-url
 */
router.post(
  "/upload",
  asyncHandler(async (req: Request, res: Response) => {
    const resp = await getUploadUrlAndCreateDocRef(req);
    return res.status(httpStatus.OK).json(resp);
  })
);

export default router;

import { S3Utils, createS3FileName } from "@metriport/core/external/aws/s3";
import { uuidv7 } from "@metriport/core/util/uuid-v7";
import { Request, Response } from "express";
import Router from "express-promise-router";
import httpStatus, { OK } from "http-status";

import { z } from "zod";
import { getETag } from "../../shared/http";
import {
  requestMetadataDataSchemaOptional,
  requestMetadataDataSchemaRequired,
} from "../../domain/medical/request";
import { RequestCreateCmd, createRequest } from "../../command/medical/request/create-request";
import { deleteRequest, RequestDeleteCmd } from "../../command/medical/request/delete-request";
import { updateRequest, RequestUpdateCmd } from "../../command/medical/request/update-request";
import { areDocumentsProcessingRequest } from "../../command/medical/document/document-status";
import { dtoFromModel } from "./dtos/requestDTO";

import { downloadDocument } from "../../command/medical/document/document-download";
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
import { stringToBoolean } from "../../shared/types";
import { sanitize } from "../helpers/string";
import { optionalDateSchema } from "../schemas/date";
import { asyncHandler, getCxIdOrFail, getFrom, getFromQueryOrFail } from "../util";
import { toDTO } from "./dtos/documentDTO";
import { docConversionTypeSchema } from "./schemas/documents";
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
    return res.status(OK).json(patient.data.documentQueryProgress);
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
 * @return The status of document querying.
 */
router.post(
  "/query",
  asyncHandler(async (req: Request, res: Response) => {
    const cxId = getCxIdOrFail(req);
    const patientId = getFromQueryOrFail("patientId", req);
    const facilityId = getFrom("query").optional("facilityId", req);
    const override = stringToBoolean(getFrom("query").optional("override", req));
    const requestMetadata = requestMetadataDataSchemaOptional.parse(req.body);

    const requestCreate: RequestCreateCmd = {
      cxId,
      facilityId,
      patientId,
      metadata: { data: requestMetadata.data },
    };

    // TODO pass REQUEST into queru.
    // TODO create DocQueryProgress Stuff

    const request = await createRequest(requestCreate);
    console.log("Request", JSON.stringify(request));

    const docQueryProgress = await queryDocumentsAcrossHIEs({
      cxId,
      patientId,
      facilityId,
      override,
    });

    return res.status(OK).json(docQueryProgress);
  })
);

/** ---------------------------------------------------------------------------
 * PUT /document/request/:id
 *
 * Updates the request according to the request ID
 * Note: this is not a PATCH, so requests must include all patient data in the payload.
 *
 * @param req.query.requestId The facility providing NPI for the patient update
 * @return The patient to be updated
 */
router.put(
  "/:id",
  asyncHandler(async (req: Request, res: Response) => {
    const cxId = getCxIdOrFail(req);
    const requestId = getFromQueryOrFail("requestId", req);
    const requestMetadata = requestMetadataDataSchemaRequired.parse(req.body);

    // TODO what is desired behavior here
    const isProcessing = await areDocumentsProcessingRequest({ id: requestId, cxId });
    if (isProcessing) {
      console.log(res.status(httpStatus.LOCKED).json("Document querying currently in progress"));
    }

    const requestUpdate: RequestUpdateCmd = {
      metadata: { data: requestMetadata.data },
      ...getETag(req),
      id: requestId,
      cxId,
    };

    const updatedRequest = await updateRequest(requestUpdate);
    return res.status(OK).json(dtoFromModel(updatedRequest));
  })
);

// TODO does this even make sense as a capability?
/** ---------------------------------------------------------------------------
 * DELETE /document/request/:id
 *
 * Deletes a Document Query request from our DB.
 *
 * @return 204 No Content
 */
router.delete(
  "/:id",
  asyncHandler(async (req: Request, res: Response) => {
    const cxId = getCxIdOrFail(req);
    const id = getFromQueryOrFail("requestId", req);
    const requestDelete: RequestDeleteCmd = {
      ...getETag(req),
      id,
      cxId,
    };
    await deleteRequest(requestDelete, { allEnvs: true });
    return res.sendStatus(httpStatus.NO_CONTENT);
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
  const type = getFrom("query").optional("conversionType", req);
  const conversionType = type ? docConversionTypeSchema.parse(type) : undefined;

  if ((typeof fileName !== "string" || fileName.indexOf(cxId) !== -1) && !Config.isSandbox()) {
    throw new ForbiddenError();
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
    const url = getDownloadUrl(req);
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
    const url = getDownloadUrl(req);
    return res.status(OK).json({ url });
  })
);

/**
 * POST /document/upload-url
 *
 * Uploads a medical document and creates a Document Reference for that file on the FHIR server.
 *
 * @param patientId - The ID of the patient.
 * @body - The DocumentReference with context for the file to be uploaded.
 *
 * @return The URL for document upload.
 * Refer to Metriport Documentation for more details:
 * https://docs.metriport.com/medical-api/api-reference/document/post-upload-url
 */
router.post(
  "/upload-url",
  asyncHandler(async (req: Request, res: Response) => {
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

    const presignedUrl = await s3Utils.getPresignedUploadUrl({
      bucket: medicalDocumentsUploadBucketName,
      key: s3FileName,
    });

    // Make a temporary DocumentReference on the FHIR server.
    console.log("Creating a temporary DocumentReference on the FHIR server with ID:", docRef.id);
    await upsertDocumentToFHIRServer(cxId, docRef);
    return res.status(httpStatus.OK).json(presignedUrl);
  })
);

export default router;

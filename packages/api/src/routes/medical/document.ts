import { createS3FileName, makeS3Client } from "@metriport/core/external/aws/s3";
import { uuidv7 } from "@metriport/core/util/uuid-v7";
import { Request, Response } from "express";
import Router from "express-promise-router";
import httpStatus, { MOVED_PERMANENTLY, OK } from "http-status";
import { z } from "zod";
import { downloadDocument } from "../../command/medical/document/document-download";
import { queryDocumentsAcrossHIEs } from "../../command/medical/document/document-query";
import { getOrganization } from "../../command/medical/organization/get-organization";
import { getPatientOrFail } from "../../command/medical/patient/get-patient";
import ForbiddenError from "../../errors/forbidden";
import { makeFhirApi } from "../../external/fhir/api/api-factory";
import {
  cxDocRefCheck,
  pickDocRefParts,
} from "../../external/fhir/document/draft-update-document-reference";
import { searchDocuments } from "../../external/fhir/document/search-documents";
import { Config } from "../../shared/config";
import { stringToBoolean } from "../../shared/types";
import { sanitize } from "../helpers/string";
import { optionalDateSchema } from "../schemas/date";
import { asyncHandler, getCxIdOrFail, getFrom, getFromQueryOrFail } from "../util";
import { toDTO } from "./dtos/documentDTO";
import { docConversionTypeSchema } from "./schemas/documents";

const UPLOAD_FILE_SIZE_LIMIT = 25_000_000; // 25MB
const UPLOAD_FILE_SIZE_LIMIT_SANDBOX = 5_000_000; // 5MB

const router = Router();
const region = Config.getAWSRegion();
const s3client = makeS3Client(region);
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
    const facilityId = getFromQueryOrFail("facilityId", req);
    const override = stringToBoolean(getFrom("query").optional("override", req));

    const docQueryProgress = await queryDocumentsAcrossHIEs({
      cxId,
      patientId,
      facilityId,
      override,
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
  const fileHasCxId = fileName.includes(cxId);
  const type = getFrom("query").optional("conversionType", req);
  const conversionType = type ? docConversionTypeSchema.parse(type) : undefined;

  if (!fileHasCxId && !Config.isSandbox()) throw new ForbiddenError();

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
    return res.status(MOVED_PERMANENTLY).json({ url });
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

// overwrite organization and patient -> don't provide cuz we will overwrite anyway
// provide as much metadata as possible
// create TODOs for checks on cx inputs
// we could require practitioner in encounter cases?
/**
 * POST /document/upload-url
 *
 * Returns a presigned URL to upload a medical document and creates a draft of a Document Reference for that file on the FHIR server.
 *
 * @param patientId - The patientId of the patient.
 *
 * @return A presigned URL to upload a file to Metriport and make the document available to other HIEs.
 * Refer to Metriport Documentation for more details:
 * https://docs.metriport.com/medical-api/api-reference/document/post-upload-url
 */
router.post(
  "/upload-url",
  asyncHandler(async (req: Request, res: Response) => {
    const cxId = getCxIdOrFail(req);
    const patientId = getFromQueryOrFail("patientId", req);
    const organization = await getOrganization({ cxId });
    if (!organization) throw new ForbiddenError(`Organization not found for CX ${cxId}`);
    console.log("ORGANIZATION", organization);

    const docRefDraft = req.body;
    cxDocRefCheck(docRefDraft);
    console.log("Document Reference Draft", docRefDraft);

    const docRef = pickDocRefParts(docRefDraft, organization);
    console.log("Updated Document Reference", JSON.stringify(docRef, null, 2));

    // Make a temporary DocumentReference on the FHIR server sandbox cxId.
    const fhirServer = makeFhirApi(cxId);
    const resultingFhirResource = await fhirServer.createResource(docRef);
    // console.log("Resulting FHIR Resource", resultingFhirResource);

    const fileId = uuidv7();
    const s3FileName = createS3FileName(cxId, patientId, fileId);
    const presignedUrl = s3client.createPresignedPost({
      Bucket: medicalDocumentsUploadBucketName,
      Fields: {
        key: s3FileName + "_upload?docRefId=" + resultingFhirResource.id,
      },
      Conditions: [
        [
          "content-length-range",
          0,
          Config.isSandbox() ? UPLOAD_FILE_SIZE_LIMIT_SANDBOX : UPLOAD_FILE_SIZE_LIMIT,
        ], // content length restrictions: 0-25MB for prod, 0-5MB for sandbox
        // ["starts-with", "$Content-Type", "image/"], // content type restriction
        ["starts-with", "$Content-Type", ""], // content type restriction
      ],
    });
    return res.status(httpStatus.OK).json(presignedUrl);
  })
);

export default router;

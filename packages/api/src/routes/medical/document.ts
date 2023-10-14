import { makeS3Client } from "@metriport/core/external/aws/s3";
import { uuidv7 } from "@metriport/core/util/uuid-v7";
import { Request, Response } from "express";
import Router from "express-promise-router";
import httpStatus, { OK } from "http-status";
import { z } from "zod";
import { downloadDocument } from "../../command/medical/document/document-download";
import { queryDocumentsAcrossHIEs } from "../../command/medical/document/document-query";
import { getPatientOrFail } from "../../command/medical/patient/get-patient";
import ForbiddenError from "../../errors/forbidden";
import { searchDocuments } from "../../external/fhir/document/search-documents";
import { Config } from "../../shared/config";
import { createS3FileName } from "../../shared/external";
import { stringToBoolean } from "../../shared/types";
import { sanitize } from "../helpers/string";
import { optionalDateSchema } from "../schemas/date";
import { asyncHandler, getCxIdOrFail, getFrom, getFromQueryOrFail } from "../util";
import { toDTO } from "./dtos/documentDTO";
import { docConversionTypeSchema } from "./schemas/documents";

const router = Router();
const region = Config.getAWSRegion();
const s3client = makeS3Client(region);
// const medicalDocumentsUploadBucketName = Config.getMedicalDocumentsUploadBucketName();

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

/** ---------------------------------------------------------------------------
 * GET /downloadUrl
 *
 * Fetches the document from S3 and sends a presigned URL
 *
 * @param req.query.fileName The file name of the document in s3.
 * @param req.query.conversionType The doc type to convert to.
 * @return presigned url
 */
router.get(
  "/downloadUrl",
  asyncHandler(async (req: Request, res: Response) => {
    const cxId = getCxIdOrFail(req);
    const fileName = getFromQueryOrFail("fileName", req);
    const fileHasCxId = fileName.includes(cxId);
    const type = getFrom("query").optional("conversionType", req);
    const conversionType = type ? docConversionTypeSchema.parse(type) : undefined;

    if (!fileHasCxId && !Config.isSandbox()) throw new ForbiddenError();

    const url = await downloadDocument({ fileName, conversionType });

    return res.status(OK).json({ url });
  })
);

/**
 * GET /upload-url
 *
 * Returns a signed url to upload a file to S3.
 *
 * @param patientId - The patientId of the patient.
 * @return presigned url
 */
router.get(
  "/upload-url",
  asyncHandler(async (req: Request, res: Response) => {
    console.log("Got the request");
    // const cxId = getCxIdOrFail(req);
    const cxId = "ramil-test-cxid";
    // const patientId = getFromQueryOrFail("patientId", req);
    const patientId = getFrom("query").orFail("patientId", req);
    // const contentType = getFrom("headers").orFail("Content-Type", req);
    const docRefId = uuidv7();
    const s3FileName = createS3FileName(cxId, patientId, docRefId);
    const presignedUrl = s3client.createPresignedPost({
      Bucket: "medical-doc-upload-staging",
      Fields: {
        key: "ramil/" + s3FileName + "_upload",
      },
      Conditions: [
        ["content-length-range", 0, 25_000_000], // content length restrictions: 0-25MB
        // ["starts-with", "$Content-Type", "image/"], // content type restriction
        ["starts-with", "$Content-Type", ""], // content type restriction
      ],
    });
    return res.status(httpStatus.OK).json(presignedUrl);
  })
);

export default router;

// s3 -> bucket / customer id/ patient id / docs
// s3 -> bucket / customer     medical-documents-upload

// Approach:
// Route to return the signed url + make api-sdk method + update docs
// Customer uses FormData with the URL to upload the file to a dedicated s3 bucket (try on devs bucket first, eventually use config bucket destination)
// Need to get patientId? -> cx provides patientId, we add it to the file name -> creates s3 bucket folder
// Lambda trigger on upload to s3 -> create a follow up TODO: lambda needs to check the file for validity (potentially use an AWS service to scan files for viruses etc /
// might want to filter file types (only allow pdfs, xmls, etc) / confirm that the file extension matches the contentType).
// Lambda to create the FHIR document reference and rename the file (removing _upload)
// trigger: refer to fhir-converter-connector.ts -> add event source: s3 event source or something like that

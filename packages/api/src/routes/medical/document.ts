import { UploadDocumentResult } from "@metriport/api-sdk";
import { searchDocuments } from "@metriport/core/command/consolidated/search/document-reference/search";
import { stringToBoolean } from "@metriport/shared";
import { Request, Response } from "express";
import Router from "express-promise-router";
import httpStatus, { OK } from "http-status";
import { z } from "zod";
import { getDocumentDownloadUrl } from "../../command/medical/document/document-download";
import { queryDocumentsAcrossHIEs } from "../../command/medical/document/document-query";
import { getUploadUrlAndCreateDocRef } from "../../command/medical/document/get-upload-url-and-create-doc-ref";
import { startBulkGetDocumentUrls } from "../../command/medical/document/start-bulk-get-doc-url";
import {} from "../../command/medical/patient/update-hie-opt-out";
import ForbiddenError from "../../errors/forbidden";
import { docRefCheck } from "../../external/fhir/document/draft-update-document-reference";
import { Config } from "../../shared/config";
import { requestLogger } from "../helpers/request-logger";
import { sanitize } from "../helpers/string";
import { getPatientInfoOrFail, patientAuthorization } from "../middlewares/patient-authorization";
import { checkRateLimit } from "../middlewares/rate-limiting";
import { optionalDateSchema } from "../schemas/date";
import { asyncHandler, getCxIdOrFail, getFrom, getFromQueryOrFail } from "../util";
import { toDTO } from "./dtos/documentDTO";
import { docConversionTypeSchema, docFileNameSchema } from "./schemas/documents";
import { cxRequestMetadataSchema } from "./schemas/request-metadata";
import { getPatientPrimaryFacilityIdOrFail } from "../../command/medical/patient/get-patient-facilities";

const router = Router();

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
 * USED WITHIN EHR INTEGRATION.
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
  requestLogger,
  patientAuthorization("query"),
  asyncHandler(async (req: Request, res: Response) => {
    const { cxId, id: patientId } = getPatientInfoOrFail(req);
    const { dateFrom, dateTo, content, output } = getDocSchema.parse(req.query);

    const documents = await searchDocuments({
      cxId,
      patientId,
      dateRange: { from: dateFrom ?? undefined, to: dateTo ?? undefined },
      contentFilter: content ? sanitize(content) : undefined,
    });
    /*
    const documents: DocumentReference[] = [
      {
        resourceType: "DocumentReference",
        id: "128",
        meta: {
          versionId: "1",
          lastUpdated: "2024-10-29T23:41:56.028+00:00",
          source: "#AIGY43ixje9OJGNj",
        },
        contained: [
          {
            resourceType: "Organization",
            id: "orgRef10",
            name: "Hospital org174",
          },
        ],
        extension: [
          {
            url: "https://public.metriport.com/fhir/StructureDefinition/data-source.json",
            valueCoding: {
              system: "https://public.metriport.com/fhir/StructureDefinition/data-source.json",
              code: "COMMONWELL",
            },
          },
        ],
        masterIdentifier: {
          system: "urn:ietf:rfc:3986",
          value: "018b26f4-ac85-7465-9dfa-3eb72526ccf8",
        },
        identifier: [
          {
            use: "official",
            system: "urn:ietf:rfc:3986",
            value: "urn:uuid:018b26f4-ac85-7465-9dfa-3eb72526ccf8",
          },
        ],
        status: "current",
        type: {
          coding: [
            {
              system: "http://loinc.org/",
              code: "75622-1",
              display: "Unknown",
            },
          ],
        },
        subject: {
          reference: "Patient/0192da90-6f7d-71bd-b40c-7ea4bafc2a43",
          type: "Patient",
        },
        date: "2023-10-13T02:54:11.000Z",
        content: [
          {
            extension: [
              {
                url: "https://public.metriport.com/fhir/StructureDefinition/data-source.json",
                valueCoding: {
                  system: "https://public.metriport.com/fhir/StructureDefinition/data-source.json",
                  code: "METRIPORT",
                },
              },
            ],
            attachment: {
              contentType: "application/pdf",
              url: "https://thomas-metriport-test-bucket.s3.us-east-2.amazonaws.com/cdb678ab-07e3-42c5-93f5-5541cf1f15a8/019393d3-7574-74b4-9364-955937a59d51/cdb678ab-07e3-42c5-93f5-5541cf1f15a8_019393d3-7574-74b4-9364-955937a59d51_jane11.pdf",
              size: 27931,
              title:
                "cdb678ab-07e3-42c5-93f5-5541cf1f15a8/019393d3-7574-74b4-9364-955937a59d51/cdb678ab-07e3-42c5-93f5-5541cf1f15a8_019393d3-7574-74b4-9364-955937a59d51_jane11.pdf",
              creation: "2023-10-12T19:54:11-07:00",
            },
            format: {
              code: "urn:ihe:pcc:xphr:2007",
            },
          },
          {
            extension: [
              {
                url: "https://public.metriport.com/fhir/StructureDefinition/data-source.json",
                valueCoding: {
                  system: "https://public.metriport.com/fhir/StructureDefinition/data-source.json",
                  code: "COMMONWELL",
                },
              },
            ],
            attachment: {
              contentType: "application/pdf",
              url: "https://integration.rest.api.commonwellalliance.org/v2/Binary/H4sIAAAAAAAEAGXLOxLCIBAA0NukY4fll01mHAsrD-ABEj4jBawiFLm9qWzs37s-ucQblzJq7sc9XEarK-ewKkAHZCQgIGoiDRoWpxAsoJSopxZf_Mmd2_Go-T3ief8PnlpPgf0osfYflEi7csmIzZMVs3FWLCFtQsd9VlY57xN9AdILCFWaAAAA0",
              size: 27931,
              title:
                "cdb678ab-07e3-42c5-93f5-5541cf1f15a8/019393d3-7574-74b4-9364-955937a59d51/cdb678ab-07e3-42c5-93f5-5541cf1f15a8_019393d3-7574-74b4-9364-955937a59d51_jane11.pdf",
              creation: "2023-10-12T19:54:11-07:00",
            },
            format: {
              code: "urn:ihe:pcc:xphr:2007",
            },
          },
        ],
        context: {
          event: [
            {
              text: "Unknown",
            },
          ],
          period: {
            start: "2023-10-13T01:54:11Z",
            end: "2023-10-13T02:54:11Z",
          },
        },
      },
      {
        resourceType: "DocumentReference",
        id: "129",
        meta: {
          versionId: "1",
          lastUpdated: "2024-10-29T23:42:15.098+00:00",
          source: "#A7vhyH6hiQg2I8cI",
        },
        contained: [
          {
            resourceType: "Organization",
            id: "org608",
            name: "Hospital org608",
          },
          {
            resourceType: "Practitioner",
            id: "auth301",
            name: [
              {
                family: "Last 301",
                given: ["First 301"],
              },
            ],
          },
        ],
        extension: [
          {
            url: "https://public.metriport.com/fhir/StructureDefinition/data-source.json",
            valueCoding: {
              system: "https://public.metriport.com/fhir/StructureDefinition/data-source.json",
              code: "METRIPORT",
            },
          },
        ],
        masterIdentifier: {
          system: "urn:ietf:rfc:3986",
          value: "018b2a0e-7647-7afe-9623-36c9f8e5746d",
        },
        identifier: [
          {
            use: "official",
            system: "urn:ietf:rfc:3986",
            value: "018b2a0e-7647-7afe-9623-36c9f8e5746d",
          },
        ],
        status: "current",
        type: {
          coding: [
            {
              system: "http://loinc.org/",
              code: "75622-1",
            },
          ],
        },
        subject: {
          reference: "Patient/0192da90-6f7d-71bd-b40c-7ea4bafc2a43",
          type: "Patient",
        },
        date: "2023-10-13T17:21:13.317Z",
        author: [
          {
            reference: "#org608",
            type: "Organization",
          },
        ],
        content: [
          {
            extension: [
              {
                url: "https://public.metriport.com/fhir/StructureDefinition/data-source.json",
                valueCoding: {
                  system: "https://public.metriport.com/fhir/StructureDefinition/data-source.json",
                  code: "METRIPORT",
                },
              },
            ],
            attachment: {
              contentType: "application/xml",
              url: "https://api.staging.metriport.com/doc-contribution/commonwell/?fileName=cdb678ab-07e3-42c5-93f5-5541cf1f15a8/019393d3-7574-74b4-9364-955937a59d51/cdb678ab-07e3-42c5-93f5-5541cf1f15a8_019393d3-7574-74b4-9364-955937a59d51_jane1.xml",
              size: 20099711,
              title:
                "cdb678ab-07e3-42c5-93f5-5541cf1f15a8/019393d3-7574-74b4-9364-955937a59d51/cdb678ab-07e3-42c5-93f5-5541cf1f15a8_019393d3-7574-74b4-9364-955937a59d51_jane1.xml",
              creation: "2023-10-13T17:21:13+00:00",
            },
            format: {
              code: "urn:ihe:pcc:xphr:2007",
            },
          },
        ],
        context: {
          period: {
            start: "2023-10-13T16:21:13.317Z",
            end: "2023-10-13T17:21:13.317Z",
          },
          sourcePatientInfo: {
            reference: "Patient/0192da90-6f7d-71bd-b40c-7ea4bafc2a43",
            type: "Patient",
          },
        },
      },
    ];
    */

    return res.status(OK).json({ documents: output === "dto" ? toDTO(documents) : documents });
  })
);

/** ---------------------------------------------------------------------------
 * GET /document/query
 *
 * Returns the document query status for the specified patient.
 *
 * USED WITHIN EHR INTEGRATION.
 *
 * @param req.query.patientId Patient ID for which to retrieve document query status.
 * @return The status of document querying across HIEs.
 */
router.get(
  "/query",
  requestLogger,
  patientAuthorization("query"),
  asyncHandler(async (req: Request, res: Response) => {
    /*
    const { patient } = getPatientInfoOrFail(req);
    return res.status(OK).json(patient.data.documentQueryProgress ?? {});
    */
    return res.status(OK).json({
      download: {
        status: "completed",
        successful: 0,
      },
      convert: {
        status: "completed",
        successful: 0,
      },
    });
  })
);

/** ---------------------------------------------------------------------------
 * POST /document/query
 *
 * Triggers a document query for the specified patient across HIEs.
 *
 * USED WITHIN EHR INTEGRATION.
 *
 * @param req.query.patientId Patient ID for which to retrieve document metadata.
 * @param req.query.facilityId The facility providing NPI for the document query.
 * @param req.query.override Whether to override files already downloaded (optional, defaults to false).
 * @param req.body Optional metadata to be sent through Webhook.
 * @return The status of document querying.
 */
router.post(
  "/query",
  checkRateLimit("documentQuery"),
  requestLogger,
  patientAuthorization("query"),
  asyncHandler(async (req: Request, res: Response) => {
    const { cxId, id: patientId } = getPatientInfoOrFail(req);
    const facilityId = getFrom("query").optional("facilityId", req);
    const override = stringToBoolean(getFrom("query").optional("override", req));
    const cxDocumentRequestMetadata = cxRequestMetadataSchema.parse(req.body);
    const forceCommonwell = stringToBoolean(getFrom("query").optional("commonwell", req));
    const forceCarequality = stringToBoolean(getFrom("query").optional("carequality", req));

    // TODO ENG-618: Temporary fix until we make facilityId required in the API
    const patientFacilityId = facilityId
      ? facilityId
      : await getPatientPrimaryFacilityIdOrFail({ cxId, patientId });

    const docQueryProgress = await queryDocumentsAcrossHIEs({
      cxId,
      patientId,
      facilityId: patientFacilityId,
      forceDownload: override,
      cxDocumentRequestMetadata: cxDocumentRequestMetadata?.metadata,
      forceCommonwell,
      forceCarequality,
    });

    return res.status(OK).json(docQueryProgress);
  })
);

// TODO see https://github.com/metriport/metriport-internal/issues/2422
/**
 * Handles the logic for download url endpoints.
 * If conversionType is specified, the document will be converted to a new format,
 * and a presigned url to download the converted document will be returned.
 * Otherwise, the a presigned url to download the raw document will be returned.
 *
 * @param req Request object.
 * @returns URL for downloading the document.
 */
async function getDownloadUrl(req: Request): Promise<string> {
  const cxId = getCxIdOrFail(req);

  const fileName = getFromQueryOrFail("fileName", req);
  const fileNameString = docFileNameSchema.parse(fileName);
  const fileHasCxId = fileNameString.includes(cxId); // Should probably check for startsWith
  const type = getFrom("query").optional("conversionType", req);
  const conversionType = type ? docConversionTypeSchema.parse(type) : undefined;

  if (!fileHasCxId && !Config.isSandbox()) {
    const message = "File name is invalid or does not exist";
    console.log(`${message}: ${fileName}, ${cxId}`);
    throw new ForbiddenError(message); // This should be 404
  }

  return await getDocumentDownloadUrl({ fileName: fileNameString, conversionType });
}

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
  requestLogger,
  asyncHandler(async (req: Request, res: Response) => {
    const url = await getDownloadUrl(req);
    return res.status(OK).json({ url });
  })
);

// TODO see https://github.com/metriport/metriport-internal/issues/2422
/** ---------------------------------------------------------------------------
 * GET /document/download-url
 *
 * Fetches the document from S3 and sends a presigned URL
 *
 * USED WITHIN EHR INTEGRATION.
 *
 * @param req.query.fileName The file name of the document in s3.
 * @param req.query.conversionType The doc type to convert to.
 * @return presigned url
 */
router.get(
  "/download-url",
  requestLogger,
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
  requestLogger,
  patientAuthorization("query"),
  asyncHandler(async (req: Request, res: Response) => {
    const { cxId, id: patientId } = getPatientInfoOrFail(req);
    const cxDownloadRequestMetadata = cxRequestMetadataSchema.parse(req.body);
    const bulkGetDocumentsUrlProgress = await startBulkGetDocumentUrls({
      cxId,
      patientId,
      cxDownloadRequestMetadata: cxDownloadRequestMetadata?.metadata,
    });

    return res.status(OK).json(bulkGetDocumentsUrlProgress);
  })
);

async function getUploadUrlAndCreateDocRefShared(req: Request): Promise<UploadDocumentResult> {
  const { cxId, id: patientId } = getPatientInfoOrFail(req);
  const docRefDraft = req.body;
  docRefCheck(docRefDraft);
  return getUploadUrlAndCreateDocRef({
    cxId,
    patientId,
    inputDocRef: docRefDraft,
  });
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
  requestLogger,
  patientAuthorization("query"),
  asyncHandler(async (req: Request, res: Response) => {
    const resp = await getUploadUrlAndCreateDocRefShared(req);
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
  requestLogger,
  patientAuthorization("query"),
  asyncHandler(async (req: Request, res: Response) => {
    const resp = await getUploadUrlAndCreateDocRefShared(req);
    return res.status(httpStatus.OK).json(resp);
  })
);

export default router;

import { Request, Response } from "express";
import Router from "express-promise-router";
import { OK } from "http-status";
import { queryDocumentsAcrossHIEs } from "../../command/medical/document/document-query";
import { getDocuments } from "../../external/fhir/document/get-documents";
import { getPatientOrFail } from "../../command/medical/patient/get-patient";
import { asyncHandler, getCxIdOrFail, getFromQuery, getFromQueryOrFail } from "../util";
import { toDTO } from "./dtos/documentDTO";
import { downloadDocument } from "../../command/medical/document/document-download";
import { DocumentQueryResp } from "../../command/medical/document/document-query";
import { createQueryResponse } from "../../command/medical/document/document-query";
import { Config } from "../../shared/config";

const router = Router();

/** ---------------------------------------------------------------------------
 * GET /document
 *
 * Queries for all available document metadata for the specified patient across HIEs.
 *
 * @param req.query.patientId Patient ID for which to retrieve document metadata.
 * @param req.query.facilityId The facility providing NPI for the document query.
 * @return The metadata of available documents.
 */
router.get(
  "/",
  asyncHandler(async (req: Request, res: Response) => {
    const cxId = getCxIdOrFail(req);
    const patientId = getFromQueryOrFail("patientId", req);
    const facilityId = getFromQueryOrFail("facilityId", req);
    const forceQuery = getFromQuery("force-query", req);

    const documents = await getDocuments({ patientId });
    const documentsDTO = toDTO(documents);

    let query: DocumentQueryResp;

    if (forceQuery) {
      query = await queryDocumentsAcrossHIEs({ cxId, patientId, facilityId });
    } else {
      const patient = await getPatientOrFail({ cxId, id: patientId });

      if (patient.data.documentQueryStatus === "processing") {
        query = createQueryResponse("processing", patient);
      } else {
        query = createQueryResponse("completed");
      }
    }

    return res.status(OK).json({
      queryStatus: query.queryStatus,
      queryProgress: query.queryProgress,
      documents: documentsDTO,
    });
  })
);

/** ---------------------------------------------------------------------------
 * GET /document/query
 *
 * Triggers a document query for the specified patient across HIEs.
 *
 * @param req.query.patientId Patient ID for which to retrieve document metadata.
 * @param req.query.facilityId The facility providing NPI for the document query.
 * @return The status of document querying.
 */
router.post(
  "/query",
  asyncHandler(async (req: Request, res: Response) => {
    const cxId = getCxIdOrFail(req);
    const patientId = getFromQueryOrFail("patientId", req);
    const facilityId = getFromQueryOrFail("facilityId", req);

    const { queryStatus, queryProgress } = await queryDocumentsAcrossHIEs({
      cxId,
      patientId,
      facilityId,
    });

    return res.status(OK).json({ queryStatus, queryProgress });
  })
);

/** ---------------------------------------------------------------------------
 * GET /downloadUrl
 *
 * Fetches the document from S3 and sends a presigned URL
 *
 * @param req.query.fileName The file name of the document in s3.
 * @return presigned url
 */
router.get(
  "/downloadUrl",
  asyncHandler(async (req: Request, res: Response) => {
    const cxId = getCxIdOrFail(req);
    const fileName = getFromQueryOrFail("fileName", req);
    const fileHasCxId = fileName.includes(cxId);

    if (!fileHasCxId && !Config.isSandbox())
      throw new Error(`File does not belong to cxId: ${cxId}`);

    const url = await downloadDocument({ fileName });

    return res.status(OK).json({ url });
  })
);

export default router;

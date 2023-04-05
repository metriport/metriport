import { Request, Response } from "express";
import Router from "express-promise-router";
import status from "http-status";
import { queryDocumentsAcrossHIEs } from "../../command/medical/document/document-query";
import { getDocuments } from "../../command/medical/document/get-documents";
import { getPatientOrFail } from "../../command/medical/patient/get-patient";
import { downloadDocument } from "../../external/commonwell/document/document-download";
import { asyncHandler, getCxIdOrFail, getFromQuery, getFromQueryOrFail } from "../util";
import { toDTO } from "./dtos/documentDTO";

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

    const documents = await getDocuments({ cxId, patientId });
    const documentsDTO = documents.map(toDTO);

    const queryStatus = forceQuery
      ? await queryDocumentsAcrossHIEs({ cxId, patientId, facilityId })
      : (await getPatientOrFail({ cxId, id: patientId })).data.documentQueryStatus ?? "completed";

    return res.status(status.OK).json({ queryStatus, documents: documentsDTO });
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

    const queryStatus = await queryDocumentsAcrossHIEs({ cxId, patientId, facilityId });

    return res.status(status.OK).json({ queryStatus });
  })
);

/** ---------------------------------------------------------------------------
 * GET /document
 *
 * Downloads the specified document for the specified patient.
 *
 * @param req.query.patientId Patient ID for which to retrieve document metadata.
 * @param req.query.facilityId The facility providing NPI for the document download.
 * @param req.query.location The document URL.
 * @param [req.query.mimeType] The mime type of the document.
 * @param [req.query.fileName] The file name of the document.
 * @return The document content.
 */
router.get(
  "/download",
  asyncHandler(async (req: Request, res: Response) => {
    const cxId = getCxIdOrFail(req);
    const patientId = getFromQueryOrFail("patientId", req);
    const facilityId = getFromQueryOrFail("facilityId", req);

    const location = getFromQueryOrFail("location", req);
    const mimeType = getFromQuery("mimeType", req);
    const fileName = getFromQuery("fileName", req);

    fileName && res.attachment(fileName);
    mimeType && res.header("Content-Type", mimeType);

    await downloadDocument({ patientId, cxId, facilityId, location, stream: res });

    return res;
  })
);

export default router;

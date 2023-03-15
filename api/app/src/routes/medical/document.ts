import { Request, Response } from "express";
import Router from "express-promise-router";
import status from "http-status";
import { downloadDocument, getDocuments } from "../../external/commonwell/document";
import { asyncHandler, getCxIdOrFail, getFromQuery, getFromQueryOrFail } from "../util";
import { dtoFromModel } from "./dtos/documentDTO";

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

    const documents = await getDocuments({ cxId, patientId, facilityId });

    const result = documents.map(dtoFromModel);
    return res.status(status.OK).json(result);
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

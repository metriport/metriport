import { Request, Response } from "express";
import Router from "express-promise-router";
import status from "http-status";
import { getDocuments } from "../../command/medical/document/get-documents";
import { getPatientOrFail } from "../../command/medical/patient/get-patient";
import { processAsyncError } from "../../errors";
import {
  downloadDocument,
  getDocuments as getDocumentsFromCW,
} from "../../external/commonwell/document";
import { PatientDataCommonwell } from "../../external/commonwell/patient-shared";
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

    const patient = await getPatientOrFail({ id: patientId, cxId });
    let queryStatus = patient.data.documentQueryStatus;

    const documents = await getDocuments({ cxId, patientId });

    // TODO: #515 We should only query on certain situations, when patient is created and/or updated.
    // This is temporary and makes the current solution extensible for that ^.
    if (queryStatus !== "processing") {
      getDocumentsFromCW({ patient, facilityId }).catch(processAsyncError(`getDocumentsFromCW`));
      // Temporary solution
      // only override the status if we have CW IDs
      const externalData = patient.data.externalData?.COMMONWELL;
      if (externalData) {
        const cwData = externalData as PatientDataCommonwell;
        if (cwData.patientId) queryStatus = "processing";
      }
    }

    const documentsDTO = documents.map(toDTO);
    return res.status(status.OK).json({ queryStatus, documents: documentsDTO });
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

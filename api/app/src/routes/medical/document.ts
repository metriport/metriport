import { Request, Response } from "express";
import Router from "express-promise-router";
import { asyncHandler, getCxIdOrFail, getPatientIdFromQueryOrFail } from "../util";
const router = Router();
import status from "http-status";
import { getPatient } from "../../command/medical/patient/get-patient";

/** ---------------------------------------------------------------------------
 * GET /document
 *
 * Queries for all available document metadata for the specified patient across HIEs.
 *
 * @param   req.query.patientId Patient ID for which to retrieve document metadata.
 * @return  {DocumentRef[]}     The available documents.
 */
router.get(
  "/",
  asyncHandler(async (req: Request, res: Response) => {
    const cxId = getCxIdOrFail(req);
    const patientId = getPatientIdFromQueryOrFail(req);

    const patient = await getPatient({ id: patientId, cxId });
    console.log(patient);
    // TODO: #374 will implement
    // CommonWell.queryDocuments()

    return res.status(status.OK).json([]);
  })
);

/** ---------------------------------------------------------------------------
 * GET /document
 *
 * Downloads the specified document for the specified patient.
 *
 * @param   req.query.patientId Patient ID for which to retrieve document metadata.
 * @return  {docUrl: string}     The available documents.
 */
router.get(
  "/download",
  asyncHandler(async (req: Request, res: Response) => {
    const cxId = getCxIdOrFail(req);
    const patientId = getPatientIdFromQueryOrFail(req);
    // get document url from query params

    const patient = await getPatient({ id: patientId, cxId });
    console.log(patient);

    // TODO: #374 will implement
    // CommonWell.retrieveDocument()

    return res.status(status.OK).json([]);
  })
);

export default router;

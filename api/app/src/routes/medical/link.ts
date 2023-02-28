import { Request, Response } from "express";
import Router from "express-promise-router";
import { asyncHandler, getCxIdOrFail, getPatientIdFromQueryOrFail } from "../util";
const router = Router();
import status from "http-status";
import { getPatient } from "../../command/medical/patient/get-patient";

/** ---------------------------------------------------------------------------
 * POST /link
 *
 * Creates link to the specified entity.
 *
 * @return  {Link}  The created link.
 */
router.post(
  "/",
  asyncHandler(async (req: Request, res: Response) => {
    const cxId = getCxIdOrFail(req);
    const patientId = getPatientIdFromQueryOrFail(req);
    const patient = await getPatient({ id: patientId, cxId });
    // get linkSource from query params -> this should be "CommonWell"
    console.log(patient);

    // CommonWell.patientLink();
    // store the following data in our DB in the patient:
    //    - link ID
    //    - person ID
    // can put this into a JSONB column `link_data` with structure:
    //    {["CommonWell"]: {cw_link_id, cw_person_id}}

    return res.status(status.OK).json({});
  })
);

/** ---------------------------------------------------------------------------
 * DELETE /link
 *
 * Removes the specified HIE link from the specified patient.
 *
 * @return  200
 */
router.delete(
  "/",
  asyncHandler(async (req: Request, res: Response) => {
    const cxId = getCxIdOrFail(req);
    const patientId = getPatientIdFromQueryOrFail(req);
    const patient = await getPatient({ id: patientId, cxId });
    // get linkSource from query params -> this should be "CommonWell"
    console.log(patient);
    // build link string from patient.linkData["CommonWell"]
    // CommonWell.resetPatientLink();

    return res.status(status.OK);
  })
);

/** ---------------------------------------------------------------------------
 * GET /link
 *
 * Builds and returns the current state of a patient's links across HIEs.
 *
 * @param   req.query.patientId Patient ID for which to retrieve links.
 * @return  {Link[]}            The patient's current and potential links.
 */
router.get(
  "/",
  asyncHandler(async (req: Request, res: Response) => {
    const cxId = getCxIdOrFail(req);
    const patientId = getPatientIdFromQueryOrFail(req);

    // TODO: Here's some pseudocode for how we can do this for CommonWell
    // (#374 will implement):

    const patient = await getPatient({ id: patientId, cxId });
    console.log(patient);
    //  - initialize currentLinks, potentialLinks
    //  - if the patient already has a link to a person
    //      - need to verify link is still valid
    //      - get the patient link -> CommonWell.getPatientLink()
    //      - if the link exists and is >= LOLA 2
    //        - add to currentLinks
    //      - else
    //        - this means the person was removed from CW
    //        - TODO: ideas on how to handle this?
    //  - if currentLinks is still empty
    //      - initialize personResultsList
    //      - if strong id is available
    //        - add to personResultsList from strong ID search -> CommonWell.searchPerson()
    //      - add to personResultsList from demo search & remove duplicates from strong ID search -> CommonWell.searchPersonByPatientDemo()
    //      - add to potentialLinks from personResultsList

    return res.status(status.OK).json([]);
  })
);

export default router;

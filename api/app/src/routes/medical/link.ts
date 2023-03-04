import { Request, Response } from "express";
import Router from "express-promise-router";
import status from "http-status";
import {
  asyncHandler,
  getCxIdOrFail,
  getPatientIdFromQueryOrFail,
  getEntityIdFromQueryOrFail,
  getLinkIdFromQueryOrFail,
} from "../util";
const router = Router();
import { getPatient } from "../../command/medical/patient/get-patient";
import { updatePatient } from "../../command/medical/patient/update-patient";
import {
  getPersonsAtCommonwell,
  getLinkFromCommonwell,
  linkPatientToCommonwellPerson,
  resetCommonwellLink,
} from "../../external/commonwell/link";
import { Config } from "../../shared/config";
import { PatientLinks } from "./schemas/link";
import { LinkSource } from "./schemas/link";

/** ---------------------------------------------------------------------------
 * POST /link
 *
 * Creates link to the specified entity.
 * @param   req.query.patientId     Patient ID to link to a person.
 * @param   req.query.entityId      Person ID to link to the patient.
 * @param   req.query.linkSource    HIE from where the link is made too.
 *
 * @return  linkId
 */
router.post(
  "/",
  asyncHandler(async (req: Request, res: Response) => {
    const cxId = getCxIdOrFail(req);
    const patientId = getPatientIdFromQueryOrFail(req);
    const entityId = getEntityIdFromQueryOrFail(req);

    const patient = await getPatient({ id: patientId, cxId });
    const linkSource = req.query.linkSource;

    // TODO: HANDLE OTHER HIE's
    if (linkSource === LinkSource.commonWell) {
      const linkId = await linkPatientToCommonwellPerson(entityId, patient.patientNumber);

      await updatePatient({
        id: patientId,
        cxId,
        linkData: {
          ...patient.linkData,
          [linkSource]: {
            cw_link_id: linkId,
            cw_person_id: entityId,
          },
        },
      });
      return res.status(status.OK).json(linkId);
    }

    throw new Error("Link source not found");
  })
);

/** ---------------------------------------------------------------------------
 * DELETE /link
 *
 * Removes the specified HIE link from the specified patient.
 * @param   req.query.patientId     Patient ID to remove link from.
 * @param   req.query.linkId        Link ID to remove.
 * @param   req.query.linkSource    HIE to remove the link from.
 * @return  200
 */
router.delete(
  "/",
  asyncHandler(async (req: Request, res: Response) => {
    const cxId = getCxIdOrFail(req);
    const patientId = getPatientIdFromQueryOrFail(req);
    const linkId = getLinkIdFromQueryOrFail(req);
    const patient = await getPatient({ id: patientId, cxId });
    const linkSource = req.query.linkSource;

    if (linkSource === LinkSource.commonWell) {
      await resetCommonwellLink(linkId);

      await updatePatient({
        id: patientId,
        cxId,
        linkData: {
          ...patient.linkData,
          [linkSource]: {},
        },
      });
    }

    return res.sendStatus(status.OK);
  })
);

/** ---------------------------------------------------------------------------
 * GET /link
 *
 * Builds and returns the current state of a patient's links across HIEs.
 *
 * @param   req.query.patientId     Patient ID for which to retrieve links.
 * @return  {PatientLinks}          The patient's current and potential links.
 */
router.get(
  "/",
  asyncHandler(async (req: Request, res: Response) => {
    const cxId = getCxIdOrFail(req);
    const patientId = getPatientIdFromQueryOrFail(req);

    // TODO: USE GET PATIENT BY DEPENCIES
    const patient = await getPatient({ id: patientId, cxId });

    const links: PatientLinks = {
      currentLinks: [],
      potentialLinks: [],
    };

    if (
      patient.linkData[LinkSource.commonWell]?.cw_link_id &&
      patient.linkData[LinkSource.commonWell]?.cw_person_id
    ) {
      const { cw_person_id, cw_link_id } = patient.linkData[LinkSource.commonWell];
      const personLink = await getLinkFromCommonwell(cw_person_id, cw_link_id);

      if (personLink) {
        links.currentLinks = [...links.currentLinks, personLink];
      } else {
        await updatePatient({
          id: patientId,
          cxId,
          linkData: {
            ...patient.linkData,
            [LinkSource.commonWell]: {},
          },
        });
      }
    }

    if (!links.currentLinks.length) {
      //      - initialize personResultsList
      //      - if strong id is available
      //        - add to personResultsList from strong ID search -> CommonWell.searchPerson()

      // TODO: Config.getSystemRootOID() needs to change to org id of the patient
      const cwPatientId = `${patient.patientNumber}^^^urn:oid:${Config.getSystemRootOID()}`;

      const personLinks = await getPersonsAtCommonwell(cwPatientId);

      links.potentialLinks = [...links.potentialLinks, ...personLinks];
    }

    //      - add to personResultsList from demo search & remove duplicates from strong ID search -> CommonWell.searchPersonByPatientDemo()

    return res.status(status.OK).json(links);
  })
);

export default router;

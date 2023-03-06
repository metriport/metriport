import { Request, Response } from "express";
import Router from "express-promise-router";
import status from "http-status";
import {
  asyncHandler,
  getCxIdOrFail,
  getPatientIdFromQueryOrFail,
  getEntityIdFromQueryOrFail,
} from "../util";
const router = Router();
import { getPatientWithDependencies } from "../../command/medical/patient/get-patient";
import { updatePatientLinks } from "../../command/medical/patient/update-patient-link";
import cwCommands from "../../external/commonwell";
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
 * @return  200
 */
router.post(
  "/",
  asyncHandler(async (req: Request, res: Response) => {
    const cxId = getCxIdOrFail(req);
    const patientId = getPatientIdFromQueryOrFail(req);
    const entityId = getEntityIdFromQueryOrFail(req);

    const { patient, organization } = await getPatientWithDependencies({ id: patientId, cxId });
    const linkSource = req.query.linkSource;

    // TODO: HANDLE OTHER HIE's
    if (linkSource === LinkSource.commonWell) {
      await cwCommands.link.create(entityId, patient, organization);

      await updatePatientLinks({
        id: patientId,
        cxId,
        linkData: {
          ...patient.linkData,
          [linkSource]: {
            cw_person_id: entityId,
          },
        },
      });
      return res.sendStatus(status.OK);
    }

    throw new Error("Link source not found");
  })
);

/** ---------------------------------------------------------------------------
 * DELETE /link
 *
 * Removes the specified HIE link from the specified patient.
 * @param   req.query.patientId     Patient ID to remove link from.
 * @param   req.query.linkSource    HIE to remove the link from.
 * @return  200
 */
router.delete(
  "/",
  asyncHandler(async (req: Request, res: Response) => {
    const cxId = getCxIdOrFail(req);
    const patientId = getPatientIdFromQueryOrFail(req);
    const { patient, organization } = await getPatientWithDependencies({ id: patientId, cxId });
    const linkSource = req.query.linkSource;

    if (linkSource === LinkSource.commonWell) {
      const hasPersonId = patient.linkData && patient.linkData[LinkSource.commonWell]?.cw_person_id;

      if (hasPersonId) {
        await cwCommands.link.reset(patient, organization, hasPersonId);

        await updatePatientLinks({
          id: patientId,
          cxId,
          linkData: {
            ...patient.linkData,
            [linkSource]: {},
          },
        });
      } else {
        throw new Error(`No person link for source: ${LinkSource.commonWell}`);
      }
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

    const { patient, organization } = await getPatientWithDependencies({ id: patientId, cxId });

    const links: PatientLinks = {
      currentLinks: [],
      potentialLinks: [],
    };

    if (patient.linkData && patient.linkData[LinkSource.commonWell]?.cw_person_id) {
      const { cw_person_id } = patient.linkData[LinkSource.commonWell];
      const personLink = await cwCommands.link.findOne(cw_person_id, organization, patient);

      if (personLink) {
        links.currentLinks = [...links.currentLinks, personLink];
      } else {
        await updatePatientLinks({
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

      const personLinks = await cwCommands.link.findAllPersons(patient, organization);

      links.potentialLinks = [...links.potentialLinks, ...personLinks];
    }

    //      - add to personResultsList from demo search & remove duplicates from strong ID search -> CommonWell.searchPersonByPatientDemo()

    return res.status(status.OK).json(links);
  })
);

export default router;

import { Request, Response } from "express";
import Router from "express-promise-router";
import status from "http-status";
import { differenceBy } from "lodash";

import {
  asyncHandler,
  getCxIdOrFail,
  getPatientIdFromParamsOrFail,
  getEntityIdFromBodyOrFail,
} from "../util";
const router = Router();
import { getPatientWithDependencies } from "../../command/medical/patient/get-patient";
import cwCommands from "../../external/commonwell";
import { PatientLinks } from "./schemas/link";
import { ExternalMedicalPartners } from "../../external";

/** ---------------------------------------------------------------------------
 * POST /patient/:patientId/link/:source
 *
 * Creates link to the specified entity.
 * @param   req.params.patientId   Patient ID to link to a person.
 * @param   req.params.source      HIE from where the link is made too.
 * @param   req.body.entityId      Person ID to link to the patient.
 *
 * @return  200
 */
router.post(
  "/:patientId/link/:source",
  asyncHandler(async (req: Request, res: Response) => {
    const cxId = getCxIdOrFail(req);
    const patientId = getPatientIdFromParamsOrFail(req);
    const entityId = getEntityIdFromBodyOrFail(req);

    const { patient, organization } = await getPatientWithDependencies({ id: patientId, cxId });
    const linkSource = req.params.source;

    if (linkSource === ExternalMedicalPartners.COMMONWELL) {
      await cwCommands.link.create(entityId, patient, organization);
    }

    return res.sendStatus(status.OK);
  })
);

/** ---------------------------------------------------------------------------
 * DELETE /patient/:patientId/link/:source
 *
 * Removes the specified HIE link from the specified patient.
 * @param   req.params.patientId     Patient ID to remove link from.
 * @param   req.params.linkSource    HIE to remove the link from.
 * @return  200
 */
router.delete(
  "/:patientId/link/:source",
  asyncHandler(async (req: Request, res: Response) => {
    const cxId = getCxIdOrFail(req);
    const patientId = getPatientIdFromParamsOrFail(req);
    const { patient, organization } = await getPatientWithDependencies({ id: patientId, cxId });
    const linkSource = req.params.source;

    if (linkSource === ExternalMedicalPartners.COMMONWELL) {
      await cwCommands.link.reset(patient, organization);
    }

    return res.sendStatus(status.OK);
  })
);

/** ---------------------------------------------------------------------------
 * GET /patient/:patientId/link
 *
 * Builds and returns the current state of a patient's links across HIEs.
 *
 * @param   req.params.patientId     Patient ID for which to retrieve links.
 * @return  {PatientLinks}          The patient's current and potential links.
 */
router.get(
  "/:patientId/link",
  asyncHandler(async (req: Request, res: Response) => {
    const cxId = getCxIdOrFail(req);
    const patientId = getPatientIdFromParamsOrFail(req);

    const { patient, organization } = await getPatientWithDependencies({ id: patientId, cxId });

    const links: PatientLinks = {
      currentLinks: [],
      potentialLinks: [],
    };

    // current links
    if (patient.data.externalData) {
      const cwLink = await cwCommands.link.findOne(patient, organization);
      if (cwLink) links.currentLinks = [...links.currentLinks, cwLink];
    }

    // potential links
    const potentialCWLinks = await cwCommands.link.findAllPotentialLinks(patient, organization);
    links.potentialLinks = [...links.potentialLinks, ...potentialCWLinks];

    if (links.currentLinks.length) {
      const removePotentialLinksDuplicates = differenceBy(
        links.potentialLinks,
        links.currentLinks,
        "entityId"
      );

      links.potentialLinks = removePotentialLinksDuplicates;
    }

    return res.status(status.OK).json(links);
  })
);

export default router;

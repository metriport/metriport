import { Request, Response } from "express";
import Router from "express-promise-router";
import status from "http-status";
import BadRequestError from "../../errors/bad-request";
import { MedicalDataSource } from "../../external";
import cwCommands from "../../external/commonwell";
import { asyncHandler, getCxIdOrFail, getFromParamsOrFail, getFromQueryOrFail } from "../util";
import { dtoFromCW, PatientLinksDTO } from "./dtos/linkDTO";
import { linkCreateSchema } from "./schemas/link";

const router = Router();

/** ---------------------------------------------------------------------------
 * POST /internal/patient/:patientId/link/:source
 *
 * Creates link to the specified entity.
 *
 * @param req.params.patientId Patient ID to link to a person.
 * @param req.params.source HIE from where the link is made to.
 * @param req.query.facilityId The ID of the facility to provide the NPI to remove link from patient.
 * @returns 201 upon success.
 */
router.post(
  "/:patientId/link/:source",
  asyncHandler(async (req: Request, res: Response) => {
    const cxId = getCxIdOrFail(req);
    const patientId = getFromParamsOrFail("patientId", req);
    const facilityId = getFromQueryOrFail("facilityId", req);
    const linkSource = getFromParamsOrFail("source", req);
    const linkCreate = linkCreateSchema.parse(req.body);

    if (linkSource === MedicalDataSource.COMMONWELL) {
      await cwCommands.link.create(linkCreate.entityId, patientId, cxId, facilityId);
      return res.sendStatus(status.CREATED);
    }
    throw new BadRequestError(`Unsupported link source: ${linkSource}`);
  })
);

/** ---------------------------------------------------------------------------
 * DELETE /internal/patient/:patientId/link/:source
 *
 * Removes the specified HIE link from the specified patient.
 *
 * @param req.params.patientId Patient ID to remove link from.
 * @param req.params.linkSource HIE to remove the link from.
 * @param req.query.facilityId The ID of the facility to provide the NPI to remove link from patient.
 * @returns 204 upon successful link delete.
 */
router.delete(
  "/:patientId/link/:source",
  asyncHandler(async (req: Request, res: Response) => {
    const cxId = getCxIdOrFail(req);
    const patientId = getFromParamsOrFail("patientId", req);
    const facilityId = getFromQueryOrFail("facilityId", req);
    const linkSource = req.params.source;

    if (linkSource === MedicalDataSource.COMMONWELL) {
      await cwCommands.link.reset(patientId, cxId, facilityId);
    }

    return res.sendStatus(status.NO_CONTENT);
  })
);

/** ---------------------------------------------------------------------------
 * GET /internal/patient/:patientId/link
 *
 * Builds and returns the current state of a patient's links across HIEs.
 *
 * @param req.params.patientId Patient ID for which to retrieve links.
 * @param req.query.facilityId The ID of the facility to provide the NPI to get links for patient.
 * @returns The patient's current and potential links.
 */
router.get(
  "/:patientId/link",
  asyncHandler(async (req: Request, res: Response) => {
    const cxId = getCxIdOrFail(req);
    const patientId = getFromParamsOrFail("patientId", req);
    const facilityId = getFromQueryOrFail("facilityId", req);

    const links: PatientLinksDTO = {
      currentLinks: [],
      potentialLinks: [],
    };

    const cwPersonLinks = await cwCommands.link.get(patientId, cxId, facilityId);
    const cwConvertedLinks = dtoFromCW({
      cwPotentialPersons: cwPersonLinks.potentialLinks,
      cwCurrentPersons: cwPersonLinks.currentLinks,
    });

    links.potentialLinks = [...cwConvertedLinks.potentialLinks];
    links.currentLinks = [...cwConvertedLinks.currentLinks];

    return res.status(status.OK).json(links);
  })
);

export default router;

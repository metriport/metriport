import { Request, Response } from "express";
import Router from "express-promise-router";
import status from "http-status";
import stringify from "json-stringify-safe";
import { getFacilities } from "../../command/medical/facility/get-facility";
import { deletePatient } from "../../command/medical/patient/delete-patient";
import { getPatients } from "../../command/medical/patient/get-patient";
import { PatientUpdateCmd, updatePatient } from "../../command/medical/patient/update-patient";
import { processAsyncError } from "../../errors";
import BadRequestError from "../../errors/bad-request";
import { MedicalDataSource } from "../../external";
import cwCommands from "../../external/commonwell";
import { recreatePatientsAtCW } from "../../external/commonwell/admin/recreate-patients-at-hies";
import { findDuplicatedPersons } from "../../external/commonwell/admin/find-patient-duplicates";
import { getUUIDFrom } from "../schemas/uuid";
import { asyncHandler, getETag, getFromParamsOrFail, getFromQueryOrFail } from "../util";
import { PatientLinksDTO, dtoFromCW } from "./dtos/linkDTO";
import { linkCreateSchema } from "./schemas/link";

const router = Router();

/** ---------------------------------------------------------------------------
 * POST /internal/patient/update-all
 *
 * Triggers an update for all of a cx's patients without changing any
 * demographics. The point of this is to trigger an outbound XCPD from
 * CommonWell to Carequality so new patient links are formed.
 *
 *
 * @param req.query.cxId The customer ID.
 * @return 200 OK
 */
router.post(
  "/update-all",
  asyncHandler(async (req: Request, res: Response) => {
    const cxId = getUUIDFrom("query", req, "cxId").orFail();
    const facilities = await getFacilities({ cxId });
    for (const facility of facilities) {
      const patients = await getPatients({ cxId, facilityId: facility.id });
      for (const patient of patients) {
        const patientUpdate: PatientUpdateCmd = {
          id: patient.id,
          cxId: patient.cxId,
          address: patient.data.address,
          dob: patient.data.dob,
          firstName: patient.data.firstName,
          genderAtBirth: patient.data.genderAtBirth,
          lastName: patient.data.lastName,
          contact: patient.data.contact,
          personalIdentifiers: patient.data.personalIdentifiers,
        };
        const updatedPatient = await updatePatient(patientUpdate);
        // Intentionally asynchronous - it takes too long to perform
        cwCommands.patient
          .update(updatedPatient, facility.id)
          .catch(processAsyncError(`cw.patient.update`));
      }
    }
    return res.sendStatus(status.OK);
  })
);

/** ---------------------------------------------------------------------------
 * DELETE /internal/patient/:id
 *
 * Deletes a patient from all storages.
 *
 * @param req.query.cxId The customer ID.
 * @param req.query.facilityId The facility providing NPI for the patient delete
 * @return 204 No Content
 */
router.delete(
  "/:id",
  asyncHandler(async (req: Request, res: Response) => {
    const cxId = getUUIDFrom("query", req, "cxId").orFail();
    const id = getFromParamsOrFail("id", req);
    const facilityId = getFromQueryOrFail("facilityId", req);

    const patientDeleteCmd = {
      ...getETag(req),
      id,
      cxId,
      facilityId,
    };
    await deletePatient(patientDeleteCmd, { allEnvs: true });

    return res.sendStatus(status.NO_CONTENT);
  })
);

/** ---------------------------------------------------------------------------
 * POST /internal/patient/:patientId/link/:source
 *
 * Creates link to the specified entity.
 *
 * @param req.params.patientId Patient ID to link to a person.
 * @param req.params.source HIE from where the link is made to.
 * @param req.query.cxId The customer ID.
 * @param req.query.facilityId The ID of the facility to provide the NPI to remove link from patient.
 * @returns 201 upon success.
 */
router.post(
  "/:patientId/link/:source",
  asyncHandler(async (req: Request, res: Response) => {
    const cxId = getUUIDFrom("query", req, "cxId").orFail();
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
 * @param req.query.cxId The customer ID.
 * @param req.query.facilityId The ID of the facility to provide the NPI to remove link from patient.
 * @returns 204 upon successful link delete.
 */
router.delete(
  "/:patientId/link/:source",
  asyncHandler(async (req: Request, res: Response) => {
    const cxId = getUUIDFrom("query", req, "cxId").orFail();
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
 * @param req.query.cxId The customer ID.
 * @param req.query.facilityId The ID of the facility to provide the NPI to get links for patient.
 * @returns The patient's current and potential links.
 */
router.get(
  "/:patientId/link",
  asyncHandler(async (req: Request, res: Response) => {
    const cxId = getUUIDFrom("query", req, "cxId").orFail();
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

/** ---------------------------------------------------------------------------
 * GET /internal/patient/duplicates
 * *
 * @param req.query.cxId The customer ID (optional, defaults to all customers).
 *
 * @return list of cxs with patients that have duplicated persons, along w/ each
 *         person, who enrolled and when
 */
router.get(
  "/duplicates",
  asyncHandler(async (req: Request, res: Response) => {
    const cxId = getUUIDFrom("query", req, "cxId").optional();
    const result = await findDuplicatedPersons(cxId);
    console.log(`Result: ${stringify(result)}`);
    return res.status(status.OK).json(result);
  })
);

/** ---------------------------------------------------------------------------
 * POST /internal/patient/recreate-at-hies
 *
 * Recreates patients at HIEs.
 *
 * @param req.query.cxId The customer ID (optional, default to all cxs).
 * @return 200 OK
 */
router.post(
  "/recreate-at-hies",
  asyncHandler(async (req: Request, res: Response) => {
    const cxId = getUUIDFrom("query", req, "cxId").optional();
    const resultCW = await recreatePatientsAtCW(cxId);
    return res.status(status.OK).json(resultCW);
  })
);

export default router;

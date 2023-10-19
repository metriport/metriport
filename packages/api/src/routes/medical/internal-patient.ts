import { executeAsynchronously } from "@metriport/core/util/concurrency";
import { Request, Response } from "express";
import Router from "express-promise-router";
import status from "http-status";
import stringify from "json-stringify-safe";
import { z } from "zod";
import { getFacilities } from "../../command/medical/facility/get-facility";
import { deletePatient } from "../../command/medical/patient/delete-patient";
import { getPatientIds, getPatients } from "../../command/medical/patient/get-patient";
import { PatientUpdateCmd, updatePatient } from "../../command/medical/patient/update-patient";
import { Patient } from "../../domain/medical/patient";
import { processAsyncError } from "../../errors";
import BadRequestError from "../../errors/bad-request";
import { MedicalDataSource } from "../../external";
import cwCommands from "../../external/commonwell";
import { findDuplicatedPersons } from "../../external/commonwell/admin/find-patient-duplicates";
import { patchDuplicatedPersonsForPatient } from "../../external/commonwell/admin/patch-patient-duplicates";
import { recreatePatientsAtCW } from "../../external/commonwell/admin/recreate-patients-at-hies";
import { getETag } from "../../shared/http";
import { errorToString } from "../../shared/log";
import { stringToBoolean } from "../../shared/types";
import { getUUIDFrom } from "../schemas/uuid";
import { asyncHandler, getFrom, getFromParamsOrFail, getFromQueryOrFail } from "../util";
import { dtoFromCW, PatientLinksDTO } from "./dtos/linkDTO";
import { linkCreateSchema } from "./schemas/link";

const router = Router();

async function updateInFHIRAndCW(
  patientUpdate: PatientUpdateCmd,
  facilityId: string
): Promise<void> {
  const updatedPatient = await updatePatient(patientUpdate);
  // Intentionally asynchronous - it takes too long to perform
  cwCommands.patient
    .update(updatedPatient, facilityId)
    .catch(processAsyncError(`cw.patient.update`));
}

const updateAllSchema = z.object({
  patientIds: z.string().array().optional(),
});

/** ---------------------------------------------------------------------------
 * POST /internal/patient/update-all
 *
 * Triggers an update for all of a cx's patients without changing any
 * demographics. The point of this is to trigger an outbound XCPD from
 * CommonWell to Carequality so new patient links are formed.
 *
 *
 * @param req.query.cxId The customer ID.
 * @param req.body.patientIds The patient IDs to update (optional, defaults to all patients).
 * @return count of update failues, 0 if all successful
 */
router.post(
  "/update-all",
  asyncHandler(async (req: Request, res: Response) => {
    const cxId = getUUIDFrom("query", req, "cxId").orFail();
    const { patientIds: requestedPatientIds = [] } = updateAllSchema.parse(req.body);

    const facilities = await getFacilities({ cxId });
    let failedUpdateCount = 0;
    for (const facility of facilities) {
      const patientIds = requestedPatientIds.length
        ? requestedPatientIds
        : await getPatientIds({ cxId, facilityId: facility.id });

      const patients = await getPatients({
        cxId,
        facilityId: facility.id,
        patientIds,
      });

      const updatePatient = async (patient: Patient) => {
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
        try {
          await updateInFHIRAndCW(patientUpdate, facility.id);
        } catch (error) {
          console.log(`Failed to update patient ${patient.id} - ${errorToString(error)}`);
          failedUpdateCount++;
        }
      };
      await executeAsynchronously(patients, async patient => updatePatient(patient), {
        numberOfParallelExecutions: 10,
      });
    }
    return res.status(status.OK).json({ failedUpdateCount });
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

// Zod schema to validate the request body based on the response of GET /duplicates
const patchDuplicatesSchema = z.record(
  // cx
  z.record(
    // patient
    z.record(
      z
        .object({
          // person
        })
        .nullish()
    )
  )
);

/** ---------------------------------------------------------------------------
 * PATCH /internal/patient/duplicates
 *
 * Links the patient to the chosen person.
 * Additionally, unenroll those enrolled by Metriport:
 * - any other person linked to the patient; AND
 * - all other persons matching the patient's demographics if the `unenrollByDemographics`
 *   query param is set to true (defaults to false).
 *
 * @param req.body The request body in the same format of the output of "GET /duplicates".
 *     Each patient must have one chosen person. Less than one it gets skipped; more
 *     than one it throws an error.
 */
router.patch(
  "/duplicates",
  asyncHandler(async (req: Request, res: Response) => {
    const unenrollByDemographics = stringToBoolean(
      getFrom("query").optional("unenrollByDemographics", req)
    );
    const payload = patchDuplicatesSchema.parse(req.body);

    const result = await Promise.allSettled(
      Object.entries(payload).flatMap(([cxId, patients]) => {
        return Object.entries(patients).flatMap(async ([patientId, persons]) => {
          const personEntries = Object.entries(persons);
          if (personEntries.length < 1) return;
          if (personEntries.length > 1)
            throw new BadRequestError(
              `Failed to patch patient ${patientId} - One chosen person per patient allowed`
            );
          const personId = personEntries[0][0] as string;
          return patchDuplicatedPersonsForPatient(
            cxId,
            patientId,
            personId,
            unenrollByDemographics
          ).catch(e => {
            console.log(`Error: ${e}, ${String(e)}`);
            throw `Failed to patch patient ${patientId} - ${String(e)}`;
          });
        });
      })
    );
    const succeded = result.filter(r => r.status === "fulfilled");
    const failed = result.flatMap(r => (r.status === "rejected" ? r.reason : []));
    return res.status(status.OK).json({
      succededCount: succeded.length,
      failedCount: failed.length,
      failed,
    });
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

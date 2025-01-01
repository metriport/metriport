import { genderAtBirthSchema } from "@metriport/api-sdk";
import dayjs from "dayjs";
import duration from "dayjs/plugin/duration";
import { Request, Response } from "express";
import Router from "express-promise-router";
import status from "http-status";
import { PatientLoaderLocal } from "../../models/helpers/patient-loader-local";
import { asyncHandler, getFrom } from "../util";
import { dtoFromModel } from "./dtos/patientDTO";
import { createPatientUniqueId } from "@metriport/core/external/carequality/shared";
import { Patient } from "@metriport/core/domain/patient";

dayjs.extend(duration);

const router = Router();
const patientLoader = new PatientLoaderLocal();

/** ---------------------------------------------------------------------------
 * GET /internal/mpi/patient
 *
 * An endpoint used by lambdas that don't have db access to find patients. Finding (blocking) patients
 * is when you use a set of criteria and find patients that match that criteria. This is used
 * in MPI systems generally.
 *
 * @param req.query.dob
 * @param req.query.gender
 * @param req.query.firstNameInitial
 * @param req.query.lastNameInitial
 *
 * @return List of patients that match the criteria
 */
router.get(
  "/patient",
  // no requestLogger here because we get too many requests (inbound CQ)
  asyncHandler(async (req: Request, res: Response) => {
    const dob = getFrom("query").orFail("dob", req);
    const genderAtBirth = genderAtBirthSchema.parse(getFrom("query").orFail("genderAtBirth", req));
    const firstNameInitial = getFrom("query").optional("firstNameInitial", req);
    const lastNameInitial = getFrom("query").optional("lastNameInitial", req);
    const foundPatients = await patientLoader.findBySimilarityAcrossAllCxs({
      data: {
        dob,
        genderAtBirth,
        firstNameInitial,
        lastNameInitial,
      },
    });
    const patientsWithUniqueId = foundPatients.map(patient => {
      const uniqueId = createPatientUniqueId(patient.cxId, patient.id);
      const updatedPatient: Patient = {
        ...patient,
        id: uniqueId,
        data: patient.data,
      };
      return updatedPatient;
    });

    return res.status(status.OK).json(patientsWithUniqueId.map(dtoFromModel));
  })
);

export default router;

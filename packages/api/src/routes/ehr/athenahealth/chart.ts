import { Request, Response } from "express";
import Router from "express-promise-router";
import httpStatus from "http-status";
import { z } from "zod";
import { writeAllergyToChart } from "../../../external/ehr/athenahealth/command/write-back/allergy";
import { writeConditionToChart } from "../../../external/ehr/athenahealth/command/write-back/condition";
import { writeImmunizationToChart } from "../../../external/ehr/athenahealth/command/write-back/immunization";
import { writeLabToChart } from "../../../external/ehr/athenahealth/command/write-back/lab";
import { writeMedicationToChart } from "../../../external/ehr/athenahealth/command/write-back/medication";
import { writeNoteToChart } from "../../../external/ehr/athenahealth/command/write-back/note";
import { writeProcedureToChart } from "../../../external/ehr/athenahealth/command/write-back/procedure";
import { writeVitalsToChart } from "../../../external/ehr/athenahealth/command/write-back/vitals";
import { handleParams } from "../../helpers/handle-params";
import { requestLogger } from "../../helpers/request-logger";
import { asyncHandler, getCxIdOrFail, getFrom, getFromQueryOrFail } from "../../util";

const router = Router();

/**
 * POST /ehr/athenahealth/chart/:id/medication
 *
 * Writes the medication to the patient's chart
 * @param req.params.id The ID of AthenaHealth Patient.
 * @param req.query.practiceId The ID of AthenaHealth Practice.
 * @param req.query.departmentId The ID of AthenaHealth Department.
 * @param req.body The FHIR Resource payload
 * @returns Athena API response
 */
router.post(
  "/:id/medication",
  handleParams,
  requestLogger,
  asyncHandler(async (req: Request, res: Response) => {
    const cxId = getCxIdOrFail(req);
    const athenaPatientId = getFrom("params").orFail("id", req);
    const athenaPracticeId = getFromQueryOrFail("practiceId", req);
    const athenaDepartmentId = getFromQueryOrFail("departmentId", req);
    const payload = req.body; // TODO Parse body https://github.com/metriport/metriport-internal/issues/2170
    const medicationDetails = await writeMedicationToChart({
      cxId,
      athenaPatientId,
      athenaPracticeId,
      athenaDepartmentId,
      medication: payload,
    });
    return res.status(httpStatus.OK).json(medicationDetails);
  })
);

/**
 * POST /ehr/athenahealth/chart/:id/condition
 *
 * Writes the condition to the patient's chart
 * @param req.params.id The ID of AthenaHealth Patient.
 * @param req.query.practiceId The ID of AthenaHealth Practice.
 * @param req.query.departmentId The ID of AthenaHealth Department.
 * @param req.body The FHIR Resource payload
 * @returns Athena API response
 */
router.post(
  "/:id/condition",
  handleParams,
  requestLogger,
  asyncHandler(async (req: Request, res: Response) => {
    const cxId = getCxIdOrFail(req);
    const athenaPatientId = getFrom("params").orFail("id", req);
    const athenaPracticeId = getFromQueryOrFail("practiceId", req);
    const athenaDepartmentId = getFromQueryOrFail("departmentId", req);
    const payload = req.body; // TODO Parse body https://github.com/metriport/metriport-internal/issues/2170
    const conditionDetails = await writeConditionToChart({
      cxId,
      athenaPatientId,
      athenaPracticeId,
      athenaDepartmentId,
      condition: payload,
    });
    return res.status(httpStatus.OK).json(conditionDetails);
  })
);

/**
 * POST /ehr/athenahealth/chart/:id/vitals
 *
 * Writes the vitals to the patient's chart
 * @param req.params.id The ID of AthenaHealth Patient.
 * @param req.query.practiceId The ID of AthenaHealth Practice.
 * @param req.query.departmentId The ID of AthenaHealth Department.
 * @param req.body The FHIR Resource payload
 * @returns Athena API response
 */
router.post(
  "/:id/vitals",
  handleParams,
  requestLogger,
  asyncHandler(async (req: Request, res: Response) => {
    const cxId = getCxIdOrFail(req);
    const athenaPatientId = getFrom("params").orFail("id", req);
    const athenaPracticeId = getFromQueryOrFail("practiceId", req);
    const athenaDepartmentId = getFromQueryOrFail("departmentId", req);
    const payload = req.body; // TODO Parse body https://github.com/metriport/metriport-internal/issues/2170
    const vitalsDetails = await writeVitalsToChart({
      cxId,
      athenaPatientId,
      athenaPracticeId,
      athenaDepartmentId,
      vitals: payload,
    });
    return res.status(httpStatus.OK).json(vitalsDetails);
  })
);

/**
 * POST /ehr/athenahealth/chart/:id/procedure
 *
 * Writes the procedure to the patient's chart
 * @param req.params.id The ID of AthenaHealth Patient.
 * @param req.query.practiceId The ID of AthenaHealth Practice.
 * @param req.query.departmentId The ID of AthenaHealth Department.
 * @param req.body The FHIR Resource payload
 * @returns Athena API response
 */
router.post(
  "/:id/procedure",
  handleParams,
  requestLogger,
  asyncHandler(async (req: Request, res: Response) => {
    const cxId = getCxIdOrFail(req);
    const athenaPatientId = getFrom("params").orFail("id", req);
    const athenaPracticeId = getFromQueryOrFail("practiceId", req);
    const athenaDepartmentId = getFromQueryOrFail("departmentId", req);
    const payload = req.body; // TODO Parse body https://github.com/metriport/metriport-internal/issues/2170
    const procedureDetails = await writeProcedureToChart({
      cxId,
      athenaPatientId,
      athenaPracticeId,
      athenaDepartmentId,
      procedure: payload,
    });
    return res.status(httpStatus.OK).json(procedureDetails);
  })
);

/**
 * POST /ehr/athenahealth/chart/:id/immunization
 *
 * Writes the immunization to the patient's chart
 * @param req.params.id The ID of AthenaHealth Patient.
 * @param req.query.practiceId The ID of AthenaHealth Practice.
 * @param req.query.departmentId The ID of AthenaHealth Department.
 * @param req.body The FHIR Resource payload
 * @returns Athena API response
 */
router.post(
  "/:id/immunization",
  handleParams,
  requestLogger,
  asyncHandler(async (req: Request, res: Response) => {
    const cxId = getCxIdOrFail(req);
    const athenaPatientId = getFrom("params").orFail("id", req);
    const athenaPracticeId = getFromQueryOrFail("practiceId", req);
    const athenaDepartmentId = getFromQueryOrFail("departmentId", req);
    const payload = req.body; // TODO Parse body https://github.com/metriport/metriport-internal/issues/2170
    const immunizationDetails = await writeImmunizationToChart({
      cxId,
      athenaPatientId,
      athenaPracticeId,
      athenaDepartmentId,
      immunization: payload,
    });
    return res.status(httpStatus.OK).json(immunizationDetails);
  })
);

/**
 * POST /ehr/athenahealth/chart/:id/allergy
 *
 * Writes the allergy to the patient's chart
 * @param req.params.id The ID of AthenaHealth Patient.
 * @param req.query.practiceId The ID of AthenaHealth Practice.
 * @param req.query.departmentId The ID of AthenaHealth Department.
 * @param req.body The FHIR Resource payload
 * @returns Athena API response
 */
router.post(
  "/:id/allergy",
  handleParams,
  requestLogger,
  asyncHandler(async (req: Request, res: Response) => {
    const cxId = getCxIdOrFail(req);
    const athenaPatientId = getFrom("params").orFail("id", req);
    const athenaPracticeId = getFromQueryOrFail("practiceId", req);
    const athenaDepartmentId = getFromQueryOrFail("departmentId", req);
    const payload = req.body; // TODO Parse body https://github.com/metriport/metriport-internal/issues/2170
    const allergyDetails = await writeAllergyToChart({
      cxId,
      athenaPatientId,
      athenaPracticeId,
      athenaDepartmentId,
      allergy: payload,
    });
    return res.status(httpStatus.OK).json(allergyDetails);
  })
);

/**
 * POST /ehr/athenahealth/chart/:id/lab
 *
 * Writes the lab result to the patient's chart
 * @param req.params.id The ID of AthenaHealth Patient.
 * @param req.query.practiceId The ID of AthenaHealth Practice.
 * @param req.query.departmentId The ID of AthenaHealth Department.
 * @param req.body The FHIR Resource payload
 * @returns Athena API response
 */
router.post(
  "/:id/lab",
  handleParams,
  requestLogger,
  asyncHandler(async (req: Request, res: Response) => {
    const cxId = getCxIdOrFail(req);
    const athenaPatientId = getFrom("params").orFail("id", req);
    const athenaPracticeId = getFromQueryOrFail("practiceId", req);
    const athenaDepartmentId = getFromQueryOrFail("departmentId", req);
    const payload = req.body; // TODO Parse body https://github.com/metriport/metriport-internal/issues/2170
    const labDetails = await writeLabToChart({
      cxId,
      athenaPatientId,
      athenaPracticeId,
      athenaDepartmentId,
      observation: payload,
    });
    return res.status(httpStatus.OK).json(labDetails);
  })
);

const noteSchema = z.object({
  date: z.string(),
  encounterText: z.string(),
});

/**
 * POST /ehr/athenahealth/chart/:id/note
 *
 * Writes the note to the patient's chart
 * @param req.params.id The ID of AthenaHealth Patient.
 * @param req.query.practiceId The ID of AthenaHealth Practice.
 * @param req.query.departmentId The ID of AthenaHealth Department.
 * @param req.body The FHIR Resource payload
 * @returns Athena API response
 */
router.post(
  "/:id/note",
  handleParams,
  requestLogger,
  asyncHandler(async (req: Request, res: Response) => {
    const cxId = getCxIdOrFail(req);
    const athenaPatientId = getFrom("params").orFail("id", req);
    const athenaPracticeId = getFromQueryOrFail("practiceId", req);
    const athenaDepartmentId = getFromQueryOrFail("departmentId", req);
    const note = noteSchema.parse(req.body);
    const noteDetails = await writeNoteToChart({
      cxId,
      athenaPatientId,
      athenaPracticeId,
      athenaDepartmentId,
      encounterText: note.encounterText,
      date: note.date,
    });
    return res.status(httpStatus.OK).json(noteDetails);
  })
);

export default router;

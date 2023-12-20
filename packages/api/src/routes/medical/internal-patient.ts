import { consolidationConversionType } from "@metriport/core/domain/conversion/fhir-to-medical-record";
import { out } from "@metriport/core/util/log";
import dayjs from "dayjs";
import duration from "dayjs/plugin/duration";
import { Request, Response } from "express";
import Router from "express-promise-router";
import status from "http-status";
import stringify from "json-stringify-safe";
import { z } from "zod";
import { getFacilityOrFail } from "../../command/medical/facility/get-facility";
import { getConsolidated } from "../../command/medical/patient/consolidated-get";
import { deletePatient } from "../../command/medical/patient/delete-patient";
import { blockPatients } from "../../command/medical/patient/mpi/block-patients";
import { convertPatientModelToPatientData } from "../../command/medical/patient/mpi/convert-patients";
import {
  getPatientIds,
  getPatientOrFail,
  getPatientStates,
} from "../../command/medical/patient/get-patient";
import { getFacilityIdOrFail } from "../../domain/medical/patient-facility";
import BadRequestError from "../../errors/bad-request";
import { MedicalDataSource } from "../../external";
import { getCxsWithEnhancedCoverageFeatureFlagValue } from "../../external/aws/appConfig";
import cwCommands from "../../external/commonwell";
import { findDuplicatedPersons } from "../../external/commonwell/admin/find-patient-duplicates";
import { patchDuplicatedPersonsForPatient } from "../../external/commonwell/admin/patch-patient-duplicates";
import { recreatePatientsAtCW } from "../../external/commonwell/admin/recreate-patients-at-hies";
import { checkStaleEnhancedCoverage } from "../../external/commonwell/cq-bridge/coverage-enhancement-check-stale";
import { completeEnhancedCoverage } from "../../external/commonwell/cq-bridge/coverage-enhancement-complete";
import { initEnhancedCoverage } from "../../external/commonwell/cq-bridge/coverage-enhancement-init";
import { cqLinkStatus } from "../../external/commonwell/patient-shared";
import { PatientUpdaterCommonWell } from "../../external/commonwell/patient-updater-commonwell";
import { parseISODate } from "../../shared/date";
import { getETag } from "../../shared/http";
import { errorToString } from "../../shared/log";
import { capture } from "../../shared/notifications";
import { stringToBoolean } from "../../shared/types";
import { stringIntegerSchema, stringListFromQuerySchema } from "../schemas/shared";
import { getUUIDFrom, uuidSchema } from "../schemas/uuid";
import { asyncHandler, getFrom, getFromParamsOrFail, getFromQueryAsArrayOrFail } from "../util";
import { dtoFromCW, PatientLinksDTO } from "./dtos/linkDTO";
import { getResourcesQueryParam } from "./schemas/fhir";
import { linkCreateSchema } from "./schemas/link";

dayjs.extend(duration);

const router = Router();

/** ---------------------------------------------------------------------------
 * GET /internal/patient/ids
 *
 * Get all patient IDs for a given customer.
 *
 * @param req.query.cxId The customer ID.
 * @returns 200 with the list of ids on the body under `patientIds`.
 */
router.get(
  "/ids",
  asyncHandler(async (req: Request, res: Response) => {
    const cxId = getUUIDFrom("query", req, "cxId").orFail();
    const facilityId = getFrom("query").optional("facilityId", req);
    if (facilityId) await getFacilityOrFail({ cxId, id: facilityId });
    const patientIds = await getPatientIds({ cxId, facilityId });
    return res.status(status.OK).json({ patientIds });
  })
);

/** ---------------------------------------------------------------------------
 * GET /internal/patient/states
 *
 * Return a list of unique US states from the patients' addresses.
 *
 * @param req.body.cxId The customer ID.
 * @param req.body.patientIds The IDs of patients to get the state from.
 * @returns 200 with the list of US states on the body under `states`.
 */
router.get(
  "/states",
  asyncHandler(async (req: Request, res: Response) => {
    const cxId = getUUIDFrom("query", req, "cxId").orFail();
    const patientIds = getFromQueryAsArrayOrFail("patientIds", req);
    const states = await getPatientStates({ cxId, patientIds });
    return res.status(status.OK).json({ states });
  })
);

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
    const { patientIds = [] } = updateAllSchema.parse(req.body);

    const { failedUpdateCount } = await new PatientUpdaterCommonWell().updateAll(cxId, patientIds);

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
    const facilityId = getFrom("query").optional("facilityId", req);

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
    const facilityIdParam = getFrom("query").optional("facilityId", req);
    const linkSource = getFromParamsOrFail("source", req);
    const linkCreate = linkCreateSchema.parse(req.body);

    const patient = await getPatientOrFail({ cxId, id: patientId });
    const facilityId = getFacilityIdOrFail(patient, facilityIdParam);

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
    const facilityIdParam = getFrom("query").optional("facilityId", req);
    const linkSource = req.params.source;

    const patient = await getPatientOrFail({ cxId, id: patientId });
    const facilityId = getFacilityIdOrFail(patient, facilityIdParam);

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
    const facilityIdParam = getFrom("query").optional("facilityId", req);

    const patient = await getPatientOrFail({ cxId, id: patientId });
    const facilityId = getFacilityIdOrFail(patient, facilityIdParam);

    const cwPersonLinks = await cwCommands.link.get(patientId, cxId, facilityId);
    const cwConvertedLinks = dtoFromCW({
      cwPotentialPersons: cwPersonLinks.potentialLinks,
      cwCurrentPersons: cwPersonLinks.currentLinks,
    });

    const links: PatientLinksDTO & { networkLinks: unknown } = {
      currentLinks: cwConvertedLinks.currentLinks,
      potentialLinks: cwConvertedLinks.potentialLinks,
      networkLinks: cwPersonLinks.networkLinks,
    };

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

const initEnhancedCoverageSchema = z.object({
  cxId: uuidSchema.optional(),
  patientIds: stringListFromQuerySchema.optional(),
  fromOrgPos: stringIntegerSchema.optional(),
});

/** ---------------------------------------------------------------------------
 * POST /internal/patient/enhance-coverage
 *
 * Trigger the job to enhance coverage of provided patients. Before doing that,
 * it also checks/fixes any stale enhanced coverage process.
 *
 * @param req.query.cxId The customer ID (optional, default to all cxs with the
 *                       respective Feature Flag enabled).
 * @param req.query.patientIds A list of patient IDs to enhance coverage (optional,
 *                             default to all elibible patients of the given customers).
 *                             If set, cxId must also be set.
 * @param req.query.fromOrgPos The position on the array of CQ Orgs to start the
 *                             Enhanced Coverage from. If set, it disables the
 *                             validation/check of Patient's cqLinkStatus
 * @return 200 OK - processing asynchronously
 */
router.post(
  "/enhance-coverage",
  asyncHandler(async (req: Request, res: Response) => {
    const { cxId, patientIds, fromOrgPos } = initEnhancedCoverageSchema.parse(req.query);

    if (patientIds && patientIds.length && !cxId) {
      throw new BadRequestError(`Customer ID is required when patient IDs are set`);
    }

    const startedAt = Date.now();
    const { log } = out(`EC endpoint - cx ${cxId ? cxId : "FF-based"}`);
    log(`Starting at ${new Date().toISOString()}`);

    try {
      const cxIds: string[] = cxId ? [cxId] : [];
      if (!cxIds.length) {
        cxIds.push(...(await getCxsWithEnhancedCoverageFeatureFlagValue()));
      }
      if (cxIds.length < 1) {
        console.log(`No customers to Enhanced Coverage, skipping...`);
        return res.status(status.OK).json({ patientIds: [] });
      }
      log(`Using these cxIds: ${cxIds.join(", ")}`);

      const checkStaleEC = !fromOrgPos || fromOrgPos <= 0;
      if (checkStaleEC) await checkStaleEnhancedCoverage(cxIds);

      const patientIdsUpdated = await initEnhancedCoverage(cxIds, patientIds, fromOrgPos);

      return res.status(status.OK).json({ patientIds: patientIdsUpdated });
    } finally {
      const duration = Date.now() - startedAt;
      const durationMin = dayjs.duration(duration).asMinutes();
      log(`Done, duration: ${duration} ms / ${durationMin} min`);
    }
  })
);

const cqLinkStatusSchema = z.enum(cqLinkStatus);

const completeEnhancedCoverageSchema = z.object({
  cxId: uuidSchema,
  patientIds: uuidSchema.array(),
  cqLinkStatus: cqLinkStatusSchema,
});

/** ---------------------------------------------------------------------------
 * POST /internal/patient/enhance-coverage/completed
 *
 * Indicate the coverage enhancement has been completed.
 *
 * @param req.query.cxId The customer ID.
 * @param req.body.patientIds The IDs of patient to update their CQLinkStatus and trigger doc query.
 * @param req.body.cqLinkStatus The status of the link to CareQuality. (one of "linked",
 *                              "processing", "failed").
 * @return 200 OK - processing asynchronously
 */
router.post(
  "/enhance-coverage/completed",
  asyncHandler(async (req: Request, res: Response) => {
    const { cxId, patientIds, cqLinkStatus } = completeEnhancedCoverageSchema.parse(req.body);

    // intentionally async, no need to wait for it
    completeEnhancedCoverage({
      cxId,
      patientIds,
      cqLinkStatus,
    }).catch(error => {
      console.log(
        `Failed to set cqLinkStatus for patients ${patientIds.join(", ")} - ${errorToString(error)}`
      );
      capture.error(error, {
        extra: {
          cxId,
          patientIds,
          cqLinkStatus,
          error,
        },
      });
    });

    return res.status(status.OK).json({ status: status[status.OK] });
  })
);

const consolidationConversionTypeSchema = z.enum(consolidationConversionType);

/** ---------------------------------------------------------------------------
 * GET /internal/patient/consolidated
 *
 * Returns a patient's consolidated data.
 *
 * @param req.query.cxId The customer ID.
 * @param req.query.patientId The ID of the patient whose data is to be returned.
 * @param req.query.resources Optional comma-separated list of resources to be returned.
 * @param req.query.dateFrom Optional start date that resources will be filtered by (inclusive).
 * @param req.query.dateTo Optional end date that resources will be filtered by (inclusive).
 * @param req.query.conversionType Optional to indicate how the medical record should be rendered.
 *        Accepts "pdf" or "html". Defaults to no conversion.
 * @return Patient's consolidated data.
 */
router.get(
  "/consolidated",
  asyncHandler(async (req: Request, res: Response) => {
    const cxId = getUUIDFrom("query", req, "cxId").orFail();
    const patientId = getFrom("query").orFail("patientId", req);
    const resources = getResourcesQueryParam(req);
    const dateFrom = parseISODate(getFrom("query").optional("dateFrom", req));
    const dateTo = parseISODate(getFrom("query").optional("dateTo", req));
    const typeRaw = getFrom("query").optional("conversionType", req);
    const conversionType = typeRaw
      ? consolidationConversionTypeSchema.parse(typeRaw.toLowerCase())
      : undefined;

    const patient = await getPatientOrFail({ cxId, id: patientId });
    const data = await getConsolidated({
      patient,
      resources,
      dateFrom,
      dateTo,
      conversionType,
    });
    return res.json(data);
  })
);

router.post(
  "/mpi/block",
  asyncHandler(async (req: Request, res: Response) => {
    const dob = getFrom("query").orFail("dob", req);
    const genderAtBirth = getFrom("query").orFail("genderAtBirth", req);
    if (genderAtBirth !== "F" && genderAtBirth !== "M") {
      throw new Error("Invalid genderAtBirth value");
    }
    const firstNameInitial = getFrom("query").optional("firstNameInitial", req);
    const lastNameInitial = getFrom("query").optional("lastNameInitial", req);

    const blockedPatients = await blockPatients({
      data: {
        dob,
        genderAtBirth,
        firstNameInitial,
        lastNameInitial,
      },
    });

    return res.status(status.OK).json(blockedPatients.map(convertPatientModelToPatientData));
  })
);

export default router;

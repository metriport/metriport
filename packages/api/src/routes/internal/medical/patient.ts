import { genderAtBirthSchema, patientCreateSchema } from "@metriport/api-sdk";
import { getConsolidatedSnapshotFromS3 } from "@metriport/core/command/consolidated/snapshot-on-s3";
import { consolidationConversionType } from "@metriport/core/domain/conversion/fhir-to-medical-record";
import { Patient } from "@metriport/core/domain/patient";
import { hl7v2SubscribersQuerySchema } from "@metriport/core/domain/patient-settings";
import { MedicalDataSource } from "@metriport/core/external/index";
import { Config } from "@metriport/core/util/config";
import { processAsyncError } from "@metriport/core/util/error/shared";
import { out } from "@metriport/core/util/log";
import {
  BadRequestError,
  errorToString,
  internalSendConsolidatedSchema,
  MetriportError,
  PaginatedResponse,
  sleep,
  stringToBoolean,
} from "@metriport/shared";
import {
  questMappingRequestSchema,
  questSource,
} from "@metriport/shared/interface/external/quest/source";
import { uuidv7 } from "@metriport/shared/util/uuid-v7";
import dayjs from "dayjs";
import duration from "dayjs/plugin/duration";
import { Request, Response } from "express";
import Router from "express-promise-router";
import status from "http-status";
import stringify from "json-stringify-safe";
import { chunk } from "lodash";
import { z } from "zod";
import {
  createPatientMapping,
  findFirstPatientMappingForSource,
} from "../../../command/mapping/patient";
import { resetExternalDataSource } from "../../../command/medical/admin/reset-external-data";
import { getFacilityOrFail } from "../../../command/medical/facility/get-facility";
import {
  getConsolidated,
  getConsolidatedAndSendToCx,
} from "../../../command/medical/patient/consolidated-get";
import { recreateConsolidated } from "../../../command/medical/patient/consolidated-recreate";
import { getCoverageAssessments } from "../../../command/medical/patient/coverage-assessment-get";
import { createPatient, PatientCreateCmd } from "../../../command/medical/patient/create-patient";
import { deletePatient } from "../../../command/medical/patient/delete-patient";
import {
  getHl7v2Subscribers,
  GetHl7v2SubscribersParams,
} from "../../../command/medical/patient/get-hl7v2-subscribers";
import {
  getPatientOrFail,
  getPatients,
  getPatientStates,
} from "../../../command/medical/patient/get-patient";
import {
  getPatientIds,
  getPatientReadOnlyOrFail,
} from "../../../command/medical/patient/get-patient-read-only";
import { processHl7FhirBundleWebhook } from "../../../command/medical/patient/hl7-fhir-webhook";
import {
  PatientUpdateCmd,
  updatePatientWithoutHIEs,
} from "../../../command/medical/patient/update-patient";
import { Pagination } from "../../../command/pagination";
import { getFacilityIdOrFail } from "../../../domain/medical/patient-facility";
import { PatientUpdaterCarequality } from "../../../external/carequality/patient-updater-carequality";
import cwCommands from "../../../external/commonwell";
import { findDuplicatedPersons } from "../../../external/commonwell-v1/admin/find-patient-duplicates";
import { patchDuplicatedPersonsForPatient } from "../../../external/commonwell-v1/admin/patch-patient-duplicates";
import { recreatePatientsAtCW } from "../../../external/commonwell-v1/admin/recreate-patients-at-hies";
import { PatientUpdaterCommonWell } from "../../../external/commonwell/patient/patient-updater-commonwell";
import { getCqOrgIdsToDenyOnCw } from "../../../external/hie/cross-hie-ids";
import { runOrSchedulePatientDiscoveryAcrossHies } from "../../../external/hie/run-or-schedule-patient-discovery";
import { PatientLoaderLocal } from "../../../models/helpers/patient-loader-local";
import { parseISODate } from "../../../shared/date";
import { getETag } from "../../../shared/http";
import { handleParams } from "../../helpers/handle-params";
import { requestLogger } from "../../helpers/request-logger";
import { dtoFromModel } from "../../medical/dtos/patientDTO";
import { getResourcesQueryParam } from "../../medical/schemas/fhir";
import { hl7NotificationSchema } from "../../medical/schemas/hl7-notification";
import { linkCreateSchema } from "../../medical/schemas/link";
import { schemaCreateToPatientData } from "../../medical/schemas/patient";
import { paginated } from "../../pagination";
import { getUUIDFrom } from "../../schemas/uuid";
import {
  asyncHandler,
  getFrom,
  getFromParamsOrFail,
  getFromQueryAsArray,
  getFromQueryAsArrayOrFail,
  getFromQueryAsBoolean,
  getFromQueryOrFail,
} from "../../util";
import patientConsolidatedRoutes from "./patient-consolidated";
import patientImportRoutes from "./patient-import";
import patientJobRoutes from "./patient-job";
import patientMonitoringRoutes from "./patient-monitoring";
import patientSettingsRoutes from "./patient-settings";

dayjs.extend(duration);

const router = Router();

router.use("/settings", patientSettingsRoutes);
router.use("/job", patientJobRoutes);
router.use("/bulk", patientImportRoutes);
router.use("/consolidated", patientConsolidatedRoutes);
router.use("/monitoring", patientMonitoringRoutes);

const patientChunkSize = 25;
const SLEEP_TIME = dayjs.duration({ seconds: 5 });
const patientLoader = new PatientLoaderLocal();

/** ---------------------------------------------------------------------------
 * GET /internal/patient/hl7v2-subscribers
 *
 * This is a paginated route.
 * Gets all patients that have the specified HL7v2 subscriptions enabled for the given states.
 *
 * @param req.query.hie The HIE to filter by.
 * @param req.query.subscriptions List of HL7v2 subscriptions to filter by. Currently, only supports "adt".
 * @param req.query.fromItem The minimum item to be included in the response, inclusive.
 * @param req.query.toItem The maximum item to be included in the response, inclusive.
 * @param req.query.count The number of items to be included in the response.
 * @returns An object containing:
 * - `patients` - List of patients with HL7v2 subscriptions in the specified states.
 * - `meta` - Pagination information, including how to get to the next page.
 */
router.get(
  "/hl7v2-subscribers",
  requestLogger,
  asyncHandler(async (req: Request, res: Response) => {
    const { hieName } = hl7v2SubscribersQuerySchema.parse(req.query);

    const params: GetHl7v2SubscribersParams = {
      hieName,
    };

    const { meta, items } = await paginated({
      request: req,
      additionalQueryParams: { hieName },
      getItems: (pagination: Pagination) => {
        return getHl7v2Subscribers({
          ...params,
          pagination,
        });
      },
      getTotalCount: () => {
        // There's no use for calculating the actual number of subscribers for this route
        return Promise.resolve(-1);
      },
      hostUrl: Config.getApiLoadBalancerAddress(),
    });

    const response: PaginatedResponse<Patient, "patients"> = {
      meta,
      patients: items,
    };
    return res.status(status.OK).json(response);
  })
);

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
  requestLogger,
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
  requestLogger,
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
 * POST /internal/patient/update-all/commonwell
 *
 * Triggers an update for all of a cx's patients without changing any
 * demographics. The point of this is to trigger an outbound XCPD from
 * CommonWell to Carequality so new patient links are formed.
 *
 * @param req.query.cxId The customer ID.
 * @param req.body.patientIds The patient IDs to update (optional, defaults to all patients).
 * @return count of update failues, 0 if all successful
 */
router.post(
  "/update-all/commonwell",
  requestLogger,
  asyncHandler(async (req: Request, res: Response) => {
    const cxId = getUUIDFrom("query", req, "cxId").orFail();
    const { patientIds } = updateAllSchema.parse(req.body);

    const { failedUpdateCount } = await new PatientUpdaterCommonWell(
      getCqOrgIdsToDenyOnCw
    ).updateAll(cxId, patientIds);

    return res.status(status.OK).json({ failedUpdateCount });
  })
);

/** ---------------------------------------------------------------------------
 * POST /internal/patient/update-all/carequality
 *
 * Triggers an update for all of a cx's patients without changing any
 * demographics. The point of this is to trigger an outbound XCPD for
 * Carequality so new patient links are formed.
 *
 * @param req.query.cxId The customer ID.
 * @param req.body.patientIds The patient IDs to update (optional, defaults to all patients).
 * @return count of update failues, 0 if all successful
 */
router.post(
  "/update-all/carequality",
  requestLogger,
  asyncHandler(async (req: Request, res: Response) => {
    const cxId = getUUIDFrom("query", req, "cxId").orFail();
    const { patientIds } = updateAllSchema.parse(req.body);

    const { failedUpdateCount } = await new PatientUpdaterCarequality().updateAll(cxId, patientIds);

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
  handleParams,
  requestLogger,
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
    await deletePatient(patientDeleteCmd);

    return res.sendStatus(status.NO_CONTENT);
  })
);

/** ---------------------------------------------------------------------------
 * POST /internal/patient/:patientId/quest-mapping
 *
 * Sets the patient's mapping to an existing external Quest ID.
 *
 * @param req.params.patientId Patient ID to link to a person.
 * @param req.query.cxId The customer ID.
 * @param req.body.externalId The existing external Quest ID to map the patient to.
 * @returns 201 upon success.
 * @returns 208 if the patient already has a Quest mapping.
 */
router.post(
  "/:patientId/quest-mapping",
  handleParams,
  requestLogger,
  asyncHandler(async (req: Request, res: Response) => {
    const cxId = getUUIDFrom("query", req, "cxId").orFail();
    const patientId = getFromParamsOrFail("patientId", req);
    const questMapping = questMappingRequestSchema.parse(req.body);

    await getPatientOrFail({ cxId, id: patientId });
    const existingMapping = await findFirstPatientMappingForSource({
      patientId,
      source: questSource,
    });
    if (existingMapping) {
      return res.sendStatus(status.ALREADY_REPORTED);
    }
    await createPatientMapping({
      cxId,
      patientId,
      externalId: questMapping.externalId,
      source: questSource,
      secondaryMappings: {},
    });
    return res.sendStatus(status.CREATED);
  })
);

/** ---------------------------------------------------------------------------
 * POST /internal/patient/:patientId/link/:source
 *
 * TODO: ENG-554 - Remove this route when we migrate to CW v2
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
  handleParams,
  requestLogger,
  asyncHandler(async (req: Request, res: Response) => {
    const cxId = getUUIDFrom("query", req, "cxId").orFail();
    const patientId = getFromParamsOrFail("patientId", req);
    const facilityIdParam = getFrom("query").optional("facilityId", req);
    const linkSource = getFromParamsOrFail("source", req);
    const linkCreate = linkCreateSchema.parse(req.body);

    const patient = await getPatientOrFail({ cxId, id: patientId });
    const facilityId = getFacilityIdOrFail(patient, facilityIdParam);

    if (linkSource === MedicalDataSource.COMMONWELL) {
      await cwCommands.link.create(
        linkCreate.entityId,
        patientId,
        cxId,
        facilityId,
        getCqOrgIdsToDenyOnCw
      );
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
  handleParams,
  requestLogger,
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
 * TODO ENG-554 Remove entirely once we've migrated to CWv2
 *
 * GET /internal/patient/duplicates
 * *
 * @param req.query.cxId The customer ID (optional, defaults to all customers).
 *
 * @return list of cxs with patients that have duplicated persons, along w/ each
 *         person, who enrolled and when
 */
router.get(
  "/duplicates",
  requestLogger,
  asyncHandler(async (req: Request, res: Response) => {
    const cxId = getUUIDFrom("query", req, "cxId").orFail();
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
  requestLogger,
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
            unenrollByDemographics,
            getCqOrgIdsToDenyOnCw
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
  requestLogger,
  asyncHandler(async (req: Request, res: Response) => {
    const cxId = getUUIDFrom("query", req, "cxId").optional();
    const resultCW = await recreatePatientsAtCW(cxId);
    return res.status(status.OK).json(resultCW);
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
 * @param req.query.documentIds Optional list of docRef IDs to filter by. If provided, only
 *            resources derived from these document references will be returned.
 * @param req.query.resources Optional comma-separated list of resources to be returned.
 * @param req.query.dateFrom Optional start date that resources will be filtered by (inclusive).
 * @param req.query.dateTo Optional end date that resources will be filtered by (inclusive).
 * @param req.query.conversionType Required to indicate how the medical record should be rendered.
 *        Accepts "pdf", "html", or "json".
 * @return Patient's consolidated data.
 */
router.get(
  "/consolidated",
  requestLogger,
  asyncHandler(async (req: Request, res: Response) => {
    const cxId = getUUIDFrom("query", req, "cxId").orFail();
    const patientId = getFrom("query").orFail("patientId", req);
    const documentIds = getFromQueryAsArray("documentIds", req);
    const resources = getResourcesQueryParam(req);
    const dateFrom = parseISODate(getFrom("query").optional("dateFrom", req));
    const dateTo = parseISODate(getFrom("query").optional("dateTo", req));
    const typeRaw = getFrom("query").orFail("conversionType", req);
    const conversionType = consolidationConversionTypeSchema.parse(typeRaw.toLowerCase());

    const patient = await getPatientOrFail({ id: patientId, cxId });
    const data = await getConsolidated({
      patient,
      documentIds,
      resources,
      dateFrom,
      dateTo,
      conversionType,
    });
    return res.json(data);
  })
);

/**
 * POST /internal/patient/trigger-update
 *
 * Triggers an update for all of a cx's patients. The point of this is to add coordinates to the patient's addresses.
 *
 * @param req.query.cxId The customer ID.
 *
 */
router.post(
  "/trigger-update",
  requestLogger,
  asyncHandler(async (req: Request, res: Response) => {
    const cxId = getUUIDFrom("query", req, "cxId").orFail();
    const patients = await getPatients({ cxId });
    const chunks = chunk(patients, patientChunkSize);
    const { log } = out(`Patient trigger update - cx ${cxId}`);
    log(`Will update ${patients.length} patients in ${chunks.length} chunks`);

    let totalUpdated = 0;
    let totalFailed = 0;
    for (const chunk of chunks) {
      const results = await Promise.allSettled(
        chunk.map(async patient => {
          try {
            const updateInfo: PatientUpdateCmd = {
              id: patient.id,
              cxId: patient.cxId,
              facilityId: getFacilityIdOrFail(patient),
              ...patient.data,
            };
            await updatePatientWithoutHIEs(updateInfo, false);
          } catch (error) {
            console.log(`Error updating patient ${patient.id}: ${errorToString(error)}`);
            throw error;
          }
        })
      );
      const successful = results.filter(r => r.status === "fulfilled").length;
      totalUpdated += successful;
      const failed = results.filter(r => r.status === "rejected").length;
      totalFailed += failed;

      log(`Updated ${successful} patients in this chunk (${failed} failed)`);
      await sleep(SLEEP_TIME.asMilliseconds());
    }

    log(`Finished updating patients, ${totalUpdated} succeeded, ${totalFailed} failed`);
    return res.sendStatus(status.OK);
  })
);

/** ---------------------------------------------------------------------------
 * GET /internal/patient/
 *
 * Returns a list of patients that match the given demographics.
 *
 * @param req.query.cxId The customer ID.
 * @param req.query.dob The patient's date of birth.
 * @param req.query.genderAtBirth The patient's gender at birth.
 * @param req.query.firstNameInitial The patient's first name initial.
 * @param req.query.lastNameInitial The patient's last name initial.
 * @return A list of patients that match the given demographics.
 */
router.get(
  "/",
  requestLogger,
  asyncHandler(async (req: Request, res: Response) => {
    const cxId = getUUIDFrom("query", req, "cxId").orFail();
    const dob = getFrom("query").orFail("dob", req);
    const genderAtBirth = genderAtBirthSchema.parse(getFrom("query").orFail("genderAtBirth", req));
    const firstNameInitial = getFrom("query").optional("firstNameInitial", req);
    const lastNameInitial = getFrom("query").optional("lastNameInitial", req);
    const foundPatients = await patientLoader.findBySimilarity({
      cxId,
      data: {
        dob,
        genderAtBirth,
        firstNameInitial,
        lastNameInitial,
      },
    });
    // TODO check if we're not returning Sequelize's Model data here; even thought the shape is Patient, the underlying object is PatientModel
    // If we are, we should convert it to a DTO. Here, on `GET /internal/patient/:id`, and on `GET /internal/mpi/patient`
    return res.status(status.OK).json(foundPatients.map(dtoFromModel));
  })
);

/** ---------------------------------------------------------------------------
 * GET /internal/patient/:id
 *
 * Returns a patient given a specific customer and patient IDs
 *
 * @param req.query.cxId The customer ID.
 * @param req.params.id The patient ID.
 * @return A patient.
 */
router.get(
  "/:id",
  handleParams,
  requestLogger,
  asyncHandler(async (req: Request, res: Response) => {
    const cxId = getUUIDFrom("query", req, "cxId").orFail();
    const id = getFromParamsOrFail("id", req);

    const patient = await getPatientReadOnlyOrFail({ cxId, patientId: id });
    const dto = dtoFromModel(patient);

    return res.status(status.OK).json(dto);
  })
);

/**
 * POST /internal/patient/:id/patient-discovery
 *
 * Kicks off patient discovery for the given patient on both CQ and CW.
 * @param req.query.cxId The customer ID.
 * @param req.params.id The patient ID.
 * @param req.query.requestId Optional. The request ID to be used for the data pipeline execution.
 * @param req.query.rerunPdOnNewDemographics Optional. Indicates whether to use demo augmentation on this PD run.
 */
router.post(
  "/:id/patient-discovery",
  handleParams,
  requestLogger,
  asyncHandler(async (req: Request, res: Response) => {
    const cxId = getUUIDFrom("query", req, "cxId").orFail();
    const id = getFromParamsOrFail("id", req);
    const requestId = getFrom("query").optional("requestId", req);
    const rerunPdOnNewDemographics = getFromQueryAsBoolean("rerunPdOnNewDemographics", req);
    const patient = await getPatientOrFail({ cxId, id });
    const facilityId = patient.facilityIds[0];

    await runOrSchedulePatientDiscoveryAcrossHies({
      patient,
      facilityId,
      rerunPdOnNewDemographics,
      requestId,
    });
    return res.status(status.OK).json({ requestId });
  })
);

// TODO 2330 Review this, it's not working
/** ---------------------------------------------------------------------------
 * POST /internal/patient/bulk/coverage-assessment
 *
 * return the coverage
 * @param req.query.cxId The customer ID.
 * @param req.params.id The patient ID.
 * @param req.query.facilityId The facility ID for running the coverage assessment.
 * @param req.query.dryrun Whether to simply validate or run the assessment (optional, defaults to false).
 *
 */
router.post(
  "/bulk/coverage-assessment",
  requestLogger,
  // asyncHandler(async (req: Request, res: Response) => {
  asyncHandler(async () => {
    throw new Error("Not implemented");
    // const cxId = getUUIDFrom("query", req, "cxId").orFail();
    // const facilityId = getFrom("query").orFail("facilityId", req);
    // const dryrun = getFromQueryAsBoolean("dryrun", req) ?? false;
    // const payload = patientImportSchema.parse(req.body);

    // const facility = await getFacilityOrFail({ cxId, id: facilityId });
    // const patientCreates: PatientCreateCmd[] = payload.patients.map(patient => {
    //   const payload = createPatientPayload(patient);
    //   return {
    //     cxId,
    //     facilityId: facility.id,
    //     ...payload,
    //   };
    // });

    // if (dryrun) return res.sendStatus(status.OK);

    // createCoverageAssessments({
    //   cxId,
    //   facilityId,
    //   patientCreates,
    // }).catch(processAsyncError("createCoverageAssessments"));

    // return res.sendStatus(status.OK);
  })
);

/** ---------------------------------------------------------------------------
 * GET /internal/patient/bulk/coverage-assessment
 *
 * Returns the cx patients for a given facility used for internal scripts
 * @param req.query.facilityId - The facility ID.
 * @return list of patients.
 */
router.get(
  "/bulk/coverage-assessment",
  requestLogger,
  asyncHandler(async (req: Request, res: Response) => {
    const cxId = getUUIDFrom("query", req, "cxId").orFail();
    const facilityId = getFrom("query").orFail("facilityId", req);
    const patients = await getPatients({ cxId, facilityId });
    const patientsWithAssessments = await getCoverageAssessments({ cxId, patients });

    const response = { patientsWithAssessments };
    return res.status(status.OK).json(response);
  })
);

/**
 * POST /internal/patient/:id/consolidated
 *
 * Continues the process of consolidating a patient's data by sending the consolidated bundle to the customer.
 *
 * @param req.query.cxId The customer ID.
 * @param req.params.id The patient ID.
 * @param req.body The data to send to getConsolidatedAndSendToCx and S3 info about the bundle to be loaded.
 * @see internalSendConsolidatedSchema on @metriport/shared
 */
router.post(
  "/:id/consolidated",
  handleParams,
  requestLogger,
  asyncHandler(async (req: Request, res: Response) => {
    const cxId = getUUIDFrom("query", req, "cxId").orFail();
    const id = getFromParamsOrFail("id", req);
    const patient = await getPatientOrFail({ id, cxId });
    const {
      requestId,
      conversionType,
      resources,
      dateFrom,
      dateTo,
      bundleLocation,
      bundleFilename,
      fromDashboard,
    } = internalSendConsolidatedSchema.parse(req.body);

    const { log } = out(`cx ${cxId}, pt ${id}, requestId ${requestId})`);
    log(`conversionType: ${conversionType}, resources: ${resources}`);

    const bundle = await getConsolidatedSnapshotFromS3({
      bundleLocation,
      bundleFilename,
    });

    getConsolidatedAndSendToCx({
      patient,
      bundle,
      requestId,
      conversionType,
      resources,
      dateFrom,
      dateTo,
      fromDashboard,
    }).catch(
      processAsyncError(
        "POST /internal/patient/:id/consolidated, calling getConsolidatedAndSendToCx"
      )
    );
    return res.sendStatus(status.OK);
  })
);

/** ---------------------------------------------------------------------------
 * POST /internal/patient
 *
 * Creates the patient corresponding to the specified facility at the
 * customer's organization if it doesn't exist already. This WILL NOT kickoff patient discovery by default.
 *
 * @param  req.query.facilityId The ID of the Facility the Patient should be associated with.
 * @return The newly created patient.
 */
router.post(
  "/",
  requestLogger,
  asyncHandler(async (req: Request, res: Response) => {
    const cxId = getUUIDFrom("query", req, "cxId").orFail();
    const facilityId = getFromQueryOrFail("facilityId", req);
    const rerunPdOnNewDemographics = stringToBoolean(
      getFrom("query").optional("rerunPdOnNewDemographics", req)
    );
    const forceCommonwell = stringToBoolean(getFrom("query").optional("commonwell", req));
    const forceCarequality = stringToBoolean(getFrom("query").optional("carequality", req));
    const runPd = getFromQueryAsBoolean("runPd", req) ?? false;
    const payload = patientCreateSchema.parse(req.body);

    const patientCreate: PatientCreateCmd = {
      ...schemaCreateToPatientData(payload),
      cxId,
      facilityId,
    };

    const patient = await createPatient({
      patient: patientCreate,
      runPd,
      rerunPdOnNewDemographics,
      forceCommonwell,
      forceCarequality,
    });

    return res.status(status.CREATED).json(dtoFromModel(patient));
  })
);

/**
 * POST /internal/patient/:id/notification/
 *
 * This is a webhook endpoint for sending HL7 FHIR bundles.
 *
 * @param req.params.id The patient ID.
 * @param req.query.cxId - The customer ID.
 * @param req.query.presignedUrl - S3 presigned URL to access the FHIR bundle.
 * @param req.query.triggerEvent - the type of HL7 notification.
 */
router.post(
  "/:id/notification",
  requestLogger,
  asyncHandler(async (req: Request, res: Response) => {
    const patientId = getFromParamsOrFail("id", req);
    const queryParams = hl7NotificationSchema.parse(req.query);

    await processHl7FhirBundleWebhook({ patientId, ...queryParams });
    return res.sendStatus(status.OK);
  })
);

/** ---------------------------------------------------------------------------
 * DELETE /internal/patient/:id/external-data
 *
 * Resets the external data corresponding to a specific source for a specific patient by removing it completely.
 *
 * @param req.params.id The patient ID.
 * @param req.query.source The HIE source (COMMONWELL or CAREQUALITY).
 * @param req.query.cxId The customer ID.
 * @return 200 OK upon successful reset.
 */
router.delete(
  "/:id/external-data",
  handleParams,
  requestLogger,
  asyncHandler(async (req: Request, res: Response) => {
    const cxId = getUUIDFrom("query", req, "cxId").orFail();
    const id = getFromParamsOrFail("id", req);
    const source = getFrom("query").orFail("source", req);

    await resetExternalDataSource({
      cxId,
      patientId: id,
      source,
    });

    return res.sendStatus(status.OK);
  })
);

/**
 * POST /internal/patient/:id/consolidated/refresh
 *
 * Forcefully recreates the consolidated bundle for a patient.
 *
 * @param req.query.cxId The customer ID.
 * @param req.params.id The patient ID.
 */
router.post(
  "/:id/consolidated/refresh",
  handleParams,
  requestLogger,
  asyncHandler(async (req: Request, res: Response) => {
    const cxId = getUUIDFrom("query", req, "cxId").orFail();
    const useCachedAiBrief = getFromQueryAsBoolean("useCachedAiBrief", req);
    const id = getFromParamsOrFail("id", req);
    const { log } = out(
      `consolidated/refresh, cx - ${cxId}, pt - ${id} useCachedAiBrief - ${useCachedAiBrief}`
    );

    const patient = await getPatientOrFail({ id, cxId });
    const requestId = uuidv7();

    try {
      await recreateConsolidated({
        patient,
        context: "internal",
        requestId,
        useCachedAiBrief,
      });
      log(`Done recreating consolidated`);
    } catch (err) {
      const msg = `Error recreating consolidated`;
      log(`${msg}, err - ${errorToString(err)}`);
      throw new MetriportError(msg, undefined, { patientId: id, cxId });
    }
    return res.status(status.OK).json({ requestId });
  })
);

export default router;

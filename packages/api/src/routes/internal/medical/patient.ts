import { genderAtBirthSchema, patientCreateSchema } from "@metriport/api-sdk";
import { getConsolidatedSnapshotFromS3 } from "@metriport/core/command/consolidated/snapshot-on-s3";
import {
  getCxsWithCQDirectFeatureFlagValue,
  getCxsWithEnhancedCoverageFeatureFlagValue,
} from "@metriport/core/command/feature-flags/domain-ffs";
import { consolidationConversionType } from "@metriport/core/domain/conversion/fhir-to-medical-record";
import { Patient } from "@metriport/core/domain/patient";
import {
  hl7v2SubscriptionRequestSchema,
  validHl7v2Subscriptions,
} from "@metriport/core/domain/patient-settings";
import { MedicalDataSource } from "@metriport/core/external/index";
import { Config } from "@metriport/core/util/config";
import { processAsyncError } from "@metriport/core/util/error/shared";
import { out } from "@metriport/core/util/log";
import {
  BadRequestError,
  MetriportError,
  PaginatedResponse,
  internalSendConsolidatedSchema,
  normalizeState,
  sleep,
  stringToBoolean,
} from "@metriport/shared";
import { buildDayjs } from "@metriport/shared/common/date";
import { errorToString } from "@metriport/shared/common/error";
import { uuidv7 } from "@metriport/shared/util/uuid-v7";
import dayjs from "dayjs";
import duration from "dayjs/plugin/duration";
import { Request, Response } from "express";
import Router from "express-promise-router";
import status from "http-status";
import stringify from "json-stringify-safe";
import { chunk } from "lodash";
import { z } from "zod";
import { resetExternalDataSource } from "../../../command/medical/admin/reset-external-data";
import { getFacilityOrFail } from "../../../command/medical/facility/get-facility";
import {
  ConsolidatedQueryParams,
  getConsolidated,
  getConsolidatedAndSendToCx,
  startConsolidatedQuery,
} from "../../../command/medical/patient/consolidated-get";
import { recreateConsolidated } from "../../../command/medical/patient/consolidated-recreate";
import { getCoverageAssessments } from "../../../command/medical/patient/coverage-assessment-get";
import { PatientCreateCmd, createPatient } from "../../../command/medical/patient/create-patient";
import { deletePatient } from "../../../command/medical/patient/delete-patient";
import {
  GetHl7v2SubscribersParams,
  getHl7v2Subscribers,
} from "../../../command/medical/patient/get-hl7v2-subscribers";
import {
  getPatientIds,
  getPatientOrFail,
  getPatientStates,
  getPatients,
} from "../../../command/medical/patient/get-patient";
import { processHl7FhirBundleWebhook } from "../../../command/medical/patient/hl7-fhir-webhook";
import {
  PatientUpdateCmd,
  updatePatientWithoutHIEs,
} from "../../../command/medical/patient/update-patient";
import { Pagination } from "../../../command/pagination";
import { getFacilityIdOrFail } from "../../../domain/medical/patient-facility";
import { PatientUpdaterCarequality } from "../../../external/carequality/patient-updater-carequality";
import cwCommands from "../../../external/commonwell";
import { findDuplicatedPersons } from "../../../external/commonwell/admin/find-patient-duplicates";
import { patchDuplicatedPersonsForPatient } from "../../../external/commonwell/admin/patch-patient-duplicates";
import { recreatePatientsAtCW } from "../../../external/commonwell/admin/recreate-patients-at-hies";
import { checkStaleEnhancedCoverage } from "../../../external/commonwell/cq-bridge/coverage-enhancement-check-stale";
import { initEnhancedCoverage } from "../../../external/commonwell/cq-bridge/coverage-enhancement-init";
import { setCQLinkStatuses } from "../../../external/commonwell/cq-bridge/cq-link-status";
import { ECUpdaterLocal } from "../../../external/commonwell/cq-bridge/ec-updater-local";
import { cqLinkStatus } from "../../../external/commonwell/patient-shared";
import { PatientUpdaterCommonWell } from "../../../external/commonwell/patient-updater-commonwell";
import { getCqOrgIdsToDenyOnCw } from "../../../external/hie/cross-hie-ids";
import { runOrSchedulePatientDiscoveryAcrossHies } from "../../../external/hie/run-or-schedule-patient-discovery";
import { PatientLoaderLocal } from "../../../models/helpers/patient-loader-local";
import { PatientModel } from "../../../models/medical/patient";
import { executeOnDBTx } from "../../../models/transaction-wrapper";
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
import {
  nonEmptyStringListFromQuerySchema,
  stringIntegerSchema,
  stringListFromQuerySchema,
} from "../../schemas/shared";
import { getUUIDFrom, uuidSchema } from "../../schemas/uuid";
import {
  asyncHandler,
  getFrom,
  getFromParamsOrFail,
  getFromQuery,
  getFromQueryAsArray,
  getFromQueryAsArrayOrFail,
  getFromQueryAsBoolean,
  getFromQueryOrFail,
} from "../../util";
import patientImportRoutes from "./patient-import";
import patientJobRoutes from "./patient-job";
import patientSettingsRoutes from "./patient-settings";

dayjs.extend(duration);

const router = Router();

router.use("/settings", patientSettingsRoutes);
router.use("/job", patientJobRoutes);
router.use("/bulk", patientImportRoutes);

const patientChunkSize = 25;
const SLEEP_TIME = dayjs.duration({ seconds: 5 });
const patientLoader = new PatientLoaderLocal();

/** ---------------------------------------------------------------------------
 * GET /internal/patient/hl7v2-subscribers
 *
 * This is a paginated route.
 * Gets all patients that have the specified HL7v2 subscriptions enabled for the given states.
 *
 * @param req.query.states List of US state codes to filter by.
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
    const stateInputs = getFromQueryAsArrayOrFail("states", req);
    const states = stateInputs.map(state => normalizeState(state));

    const subscriptions = getFromQueryAsArrayOrFail("subscriptions", req);

    const { validSubscriptions, invalidSubscriptions } = hl7v2SubscriptionRequestSchema.parse({
      subscriptions,
    }).subscriptions;

    if (invalidSubscriptions.length > 0) {
      throw new BadRequestError(
        `Invalid subscription options provided. Valid options are: ${validHl7v2Subscriptions.join(
          ", "
        )}`
      );
    }

    const params: GetHl7v2SubscribersParams = {
      states,
      subscriptions: validSubscriptions,
    };

    const { meta, items } = await paginated({
      request: req,
      additionalQueryParams: { states: states.join(","), subscriptions: subscriptions.join(",") },
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

const initEnhancedCoverageSchema = z.object({
  cxId: uuidSchema.optional(),
  patientIds: stringListFromQuerySchema.optional(),
  fromOrgPos: stringIntegerSchema.optional(),
});

/** ---------------------------------------------------------------------------
 * POST /internal/patient/enhance-coverage
 *
 * @deprecated #1543 REMOVE THIS AND RELATED/DOWNSTREAM CODE
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
  requestLogger,
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

      // Filter out customers that have CQ Direct feature flag enabled
      const cqDirectCxIds = await getCxsWithCQDirectFeatureFlagValue();
      const filteredCxIds = cxIds.filter(cxId => !cqDirectCxIds.includes(cxId));

      if (filteredCxIds.length < 1 && cxIds.length == 1) {
        log(`Customer ${cxIds[0]} has CQ Direct enabled, skipping...`);
        return res.status(status.OK).json({ patientIds: [] });
      } else if (filteredCxIds.length < 1) {
        log(`No customers to Enhanced Coverage, skipping...`);
        return res.status(status.OK).json({ patientIds: [] });
      }
      log(`Using these cxIds: ${cxIds.join(", ")}`);

      const checkStaleEC = !fromOrgPos || fromOrgPos <= 0;
      if (checkStaleEC) await checkStaleEnhancedCoverage(filteredCxIds);

      const patientIdsUpdated = await initEnhancedCoverage(filteredCxIds, patientIds, fromOrgPos);

      return res.status(status.OK).json({ patientIds: patientIdsUpdated });
    } finally {
      const duration = Date.now() - startedAt;
      const durationMin = dayjs.duration(duration).asMinutes();
      log(`Done, duration: ${duration} ms / ${durationMin} min`);
    }
  })
);

const cqLinkStatusSchema = z.enum(cqLinkStatus);

/**
 * POST /internal/patient/enhance-coverage/set-cq-link-statuses
 *
 * @deprecated #1543 REMOVE THIS AND RELATED/DOWNSTREAM CODE
 *
 * Sets the CQ link statuses to complete the enhanced coverage flow for a list of patients.
 * @param req.query.cxId The customer ID.
 * @param req.query.patientIds The IDs of the patients to complete the process for.
 * @param req.query.cqLinkStatus The status to set the CQ link to.
 */
router.post(
  "/enhance-coverage/set-cq-link-statuses",
  requestLogger,
  asyncHandler(async (req: Request, res: Response) => {
    const cxId = getUUIDFrom("query", req, "cxId").orFail();
    const patientIds = getFromQueryAsArrayOrFail("patientIds", req);
    const cqLinkStatusParam = getFrom("query").orFail("cqLinkStatus", req);
    const cqLinkStatus = cqLinkStatusSchema.parse(cqLinkStatusParam);

    await setCQLinkStatuses({ cxId, patientIds, cqLinkStatus });
    return res.sendStatus(status.OK);
  })
);

const updateECAfterIncludeListSchema = z.object({
  ecId: uuidSchema,
  cxId: uuidSchema,
  patientIds: nonEmptyStringListFromQuerySchema,
  cqOrgIds: nonEmptyStringListFromQuerySchema,
});

/** ---------------------------------------------------------------------------
 * POST /internal/patient/enhance-coverage/after-include-list
 *
 * @deprecated #1543 REMOVE THIS AND RELATED/DOWNSTREAM CODE
 *
 * Store the result of running Enhanced Coverage from the local environment.
 *
 * @return 200 OK
 */
router.post(
  "/enhance-coverage/after-include-list",
  requestLogger,
  asyncHandler(async (req: Request, res: Response) => {
    const { ecId, cxId, patientIds, cqOrgIds } = updateECAfterIncludeListSchema.parse(req.query);
    if (patientIds && !patientIds.length) throw new BadRequestError(`Patient IDs are required`);
    if (cqOrgIds && !cqOrgIds.length) throw new BadRequestError(`CQ Org IDs are required`);

    await new ECUpdaterLocal().storeECAfterIncludeList({
      ecId,
      cxId,
      patientIds,
      cqOrgIds,
    });
    return res.sendStatus(status.OK);
  })
);

const updateECAfterDocQuerySchema = z.object({
  ecId: uuidSchema,
  cxId: uuidSchema,
  patientId: uuidSchema,
  docsFound: stringIntegerSchema,
});

/** ---------------------------------------------------------------------------
 * POST /internal/patient/enhance-coverage/after-doc-query
 *
 * @deprecated #1543 REMOVE THIS AND RELATED/DOWNSTREAM CODE
 *
 * Store the result of running Enhanced Coverage from the local environment.
 *
 * @return 200 OK
 */
router.post(
  "/enhance-coverage/after-doc-query",
  requestLogger,
  asyncHandler(async (req: Request, res: Response) => {
    const { ecId, cxId, patientId, docsFound } = updateECAfterDocQuerySchema.parse(req.query);
    if (docsFound < 0) {
      console.log(
        `[/enhance-coverage/after-doc-query] Invalid docsFound: ${docsFound}, patientId: ${patientId}, ecId: ${ecId}`
      );
      throw new BadRequestError(`Docs found must be >= 0`);
    }

    await new ECUpdaterLocal().storeECAfterDocQuery({
      ecId,
      cxId,
      patientId,
      docsFound,
    });
    return res.sendStatus(status.OK);
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
 * @param req.query.conversionType Optional to indicate how the medical record should be rendered.
 *        Accepts "pdf" or "html". Defaults to no conversion.
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
    const typeRaw = getFrom("query").optional("conversionType", req);
    const conversionType = typeRaw
      ? consolidationConversionTypeSchema.parse(typeRaw.toLowerCase())
      : undefined;

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
 * return a patient given a specific customer id and patient id
 * @param req.query.cxId The customer ID.
 * @param req.params.id The patient ID.
 * @return A patient.
 *
 */
router.get(
  "/:id",
  handleParams,
  requestLogger,
  asyncHandler(async (req: Request, res: Response) => {
    const cxId = getUUIDFrom("query", req, "cxId").orFail();
    const id = getFromParamsOrFail("id", req);

    const patient = await getPatientOrFail({ cxId, id });

    return res.status(status.OK).json(dtoFromModel(patient));
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
 * POST /internal/patient/consolidated/query
 *
 * For each patient, get all consolidated queries that are older than 1 hour and are still processing, and:
 * - update the status of the query to "failed"; and
 * - start a new consolidated query with the same parameters.
 *
 * @param req.query.patientIds The patient IDs.
 * @param req.query.minAgeInMinutes The minimum age in minutes for the queries to be processed (optional,
 *        defaults to 60 minutes).
 * @param req.query.dryRun Whether to simply return what would be done or actually execute the changes
 *        and commands.
 * @return The list of consolidated queries that where be executed (or would be executed, if dryRun is true).
 */
router.post(
  "/consolidated/query",
  requestLogger,
  asyncHandler(async (req: Request, res: Response) => {
    const patientIds = getFromQueryAsArrayOrFail("patientIds", req);
    const skipWebhooks = getFromQueryAsBoolean("skipWebhooks", req);
    if (skipWebhooks === undefined) throw new BadRequestError("skipWebhooks is required");
    const dryRun = getFromQueryAsBoolean("dryRun", req);
    if (dryRun === undefined) throw new BadRequestError("dryRun is required");
    const minAgeRaw = getFromQuery("minAgeInMinutes", req);
    const minAgeInMinutes = minAgeRaw ? parseInt(minAgeRaw) : 60;

    // TODO move this to an ops/internal command

    const patientsNotFound: string[] = [];
    const patientsUpdated: string[] = [];
    const patientsWithoutQueries: string[] = [];

    const triggeredQueries: ConsolidatedQueryParams[] = [];
    for (const patientId of patientIds) {
      const { log } = out(`patientId ${patientId} minAge ${minAgeInMinutes} dryRun ${dryRun}`);
      await executeOnDBTx(PatientModel.prototype, async transaction => {
        const patient = await PatientModel.findOne({
          where: { id: patientId },
          transaction,
        });
        if (!patient) {
          patientsNotFound.push(patientId);
          log(`not found`);
          return;
        }
        const consolidatedQueries = patient.data.consolidatedQueries ?? [];
        const queriesToProcess = consolidatedQueries.filter(
          query =>
            query.status === "processing" &&
            buildDayjs(query.startedAt).isBefore(
              buildDayjs().subtract(minAgeInMinutes, "minutes").toISOString()
            )
        );
        log(`queriesToProcess ${queriesToProcess.length}`);
        if (queriesToProcess.length > 0) {
          patientsUpdated.push(patientId);
          queriesToProcess.forEach(query => {
            query.status = "failed";
          });
          if (!dryRun) {
            const data = {
              ...patient.data,
              consolidatedQueries,
            };
            patient.changed("data", true);
            await patient.update({ data });
          }
        } else {
          patientsWithoutQueries.push(patientId);
        }
        for (const query of queriesToProcess) {
          const cxConsolidatedRequestMetadata = skipWebhooks ? { disableWHFlag: true } : undefined;
          const startConsolidatedQueryParams: ConsolidatedQueryParams = {
            cxId: patient.cxId,
            patientId,
            resources: query.resources,
            dateFrom: query.dateFrom,
            dateTo: query.dateTo,
            conversionType: query.conversionType,
            generateAiBrief: query.generateAiBrief,
            cxConsolidatedRequestMetadata,
          };
          triggeredQueries.push(startConsolidatedQueryParams);
          if (!dryRun) {
            const query = await startConsolidatedQuery(startConsolidatedQueryParams);
            log(`triggered query ${JSON.stringify(query)}`);
          }
        }
      });
    }

    const { log } = out(`dryRun ${dryRun}`);

    const response = {
      dryRun,
      skipWebhooks,
      patientsNotFound,
      patientsUpdated,
      patientsWithoutQueries,
      triggeredQueries,
    };
    log(`response ${JSON.stringify(response)}`);

    return res.status(status.OK).json(response);
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
 * POST /internal/patient/:id/recreate-consolidated
 *
 * Forcefully recreates the consolidated bundle for a patient.
 *
 * @param req.query.cxId The customer ID.
 * @param req.params.id The patient ID.
 */
router.post(
  "/:id/recreate-consolidated",
  handleParams,
  requestLogger,
  asyncHandler(async (req: Request, res: Response) => {
    const cxId = getUUIDFrom("query", req, "cxId").orFail();
    const id = getFromParamsOrFail("id", req);
    const { log } = out(`recreate-consolidated, cx - ${cxId}, pt - ${id} `);

    const patient = await getPatientOrFail({ id, cxId });
    const requestId = uuidv7();

    try {
      await recreateConsolidated({ patient, context: "internal", requestId });
      log(`Done recreating consolidated`);
    } catch (err) {
      const msg = `Error recreating consolidated`;
      log(`${msg}, err - ${errorToString(err)}`);
      throw new MetriportError(msg, { extra: { patientId: id } });
    }
    return res.status(status.OK).json({ requestId });
  })
);

export default router;

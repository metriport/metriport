import { genderAtBirthSchema, patientCreateSchema } from "@metriport/api-sdk";
import { getConsolidatedSnapshotFromS3 } from "@metriport/core/command/consolidated/snapshot-on-s3";
import { getPatientStateWithOverallStatus } from "@metriport/core/command/patient-state/get-patient-state";
import { consolidationConversionType } from "@metriport/core/domain/conversion/fhir-to-medical-record";
import { Patient } from "@metriport/core/domain/patient";
import { hl7v2SubscribersQuerySchema } from "@metriport/core/domain/patient-settings";
import { MedicalDataSource } from "@metriport/core/external";
import { Config } from "@metriport/core/util/config";
import { processAsyncError } from "@metriport/core/util/error/shared";
import { out } from "@metriport/core/util/log";
import {
  errorToString,
  internalSendConsolidatedSchema,
  MetriportError,
  NotFoundError,
  PaginatedResponse,
  parseEhrSourceOrFail,
  sleep,
  stringToBoolean,
} from "@metriport/shared";
import {
  DatasourceQueryStatus,
  hieSpecificSource,
} from "@metriport/shared/domain/network-query/source";
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
import { chunk } from "lodash";
import { z } from "zod";
import { internalOnlyGetPatientReadOnlyByIdOrFail } from "../../../command/internal/get-patient-read-only";
import {
  createPatientMapping,
  findFirstPatientMappingForSource,
} from "../../../command/mapping/patient";
import { resetExternalDataSource } from "../../../command/medical/admin/reset-external-data";
import { listCohortsWithSizesForPatient } from "../../../command/medical/cohort/get-cohort";
import { addPatientToCohorts } from "../../../command/medical/cohort/patient-cohort/add-patient-to-cohorts";
import { getFacilityOrFail } from "../../../command/medical/facility/get-facility";
import { getNetworkQueryStatusByRequestId } from "../../../command/medical/network-query/network-query";
import { updateDatasourceQueryStatusByRequestId } from "../../../command/medical/network-query/update-datasource-query-status";
import { getOrganizations } from "../../../command/medical/organization/get-organization";
import {
  getConsolidated,
  getConsolidatedAndSendToCx,
} from "../../../command/medical/patient/consolidated-get";
import { recreateConsolidated } from "../../../command/medical/patient/consolidated-recreate";
import { getCoverageAssessments } from "../../../command/medical/patient/coverage-assessment-get";
import { createOrUpdatePatientBasedOnDemo } from "../../../command/medical/patient/create-or-update-patient";
import { PatientCreateCmd } from "../../../command/medical/patient/create-patient";
import { deletePatient } from "../../../command/medical/patient/delete-patient";
import {
  getHl7v2Subscribers,
  GetHl7v2SubscribersParams,
} from "../../../command/medical/patient/get-hl7v2-subscribers";
import {
  getPatientByExternalId,
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
import { createAugmentedPatient } from "../../../domain/medical/patient-demographics";
import { getFacilityIdOrFail } from "../../../domain/medical/patient-facility";
import { PatientUpdaterCarequality } from "../../../external/carequality/patient-updater-carequality";
import { PatientUpdaterCommonWell } from "../../../external/commonwell/patient/patient-updater-commonwell";
import { runOrSchedulePatientDiscoveryAcrossHies } from "../../../external/hie/run-or-schedule-patient-discovery";
import { PatientLoaderLocal } from "../../../models/helpers/patient-loader-local";
import { parseISODate } from "../../../shared/date";
import { getETag } from "../../../shared/http";
import { handleParams } from "../../helpers/handle-params";
import { requestLogger } from "../../helpers/request-logger";
import { dtoFromModel } from "../../medical/dtos/patientDTO";
import { cohortIdsSchema } from "../../medical/schemas/cohort";
import { getResourcesQueryParam } from "../../medical/schemas/fhir";
import { hl7NotificationSchema } from "../../medical/schemas/hl7-notification";
import { schemaCreateToPatientData } from "../../medical/schemas/patient";
import { paginated } from "../../pagination";
import { getUUIDFrom } from "../../schemas/uuid";
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
import patientConsolidatedRoutes from "./patient-consolidated";
import patientImportRoutes from "./patient-import";
import patientJobRoutes from "./patient-job";
import patientSettingsRoutes from "./patient-settings";
import patientMonitoringRoutes from "./patient/patient-monitoring";

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
    const { hieStates, hieName } = hl7v2SubscribersQuerySchema.parse(req.query);

    const params: GetHl7v2SubscribersParams = {
      hieStates,
      hieName,
    };

    const hieStatesQueryParams = Object.fromEntries(
      hieStates.map((state, index) => [`hieStates[${index}]`, state])
    );

    const { meta, items } = await paginated({
      request: req,
      additionalQueryParams: {
        hieName,
        ...hieStatesQueryParams,
      },
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

    const { failedUpdateCount } = await new PatientUpdaterCommonWell().updateAll(cxId, patientIds);

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

/**
 * GET /internal/patient/external-id
 *
 * Searches for a patient based on an external ID. Returns the first and last name of the patient, if it exists.
 *
 * @return The first and last name of the patient.
 */
router.get(
  "/external-id",
  requestLogger,
  asyncHandler(async (req: Request, res: Response) => {
    const cxId = getUUIDFrom("query", req, "cxId").orFail();
    const externalId = getFromQueryOrFail("externalId", req);
    const unparsedSource = getFromQuery("source", req);
    const source = parseEhrSourceOrFail(unparsedSource);
    const patient = await getPatientByExternalId({ cxId, externalId, source });
    if (!patient) {
      throw new NotFoundError("Patient not found");
    }
    return res
      .status(status.OK)
      .json({ id: patient.id, firstName: patient.data.firstName, lastName: patient.data.lastName });
  })
);

/** ---------------------------------------------------------------------------
 * GET /internal/patient/:id/consolidated-link-demographics
 *
 * Returns the consolidated link demographics for a patient
 *
 * @param req.query.cxId The customer ID.
 * @param req.params.id The patient ID.
 * @return The consolidated link demographics or null if not present.
 */
router.get(
  "/:id/consolidated-link-demographics",
  handleParams,
  requestLogger,
  asyncHandler(async (req: Request, res: Response) => {
    const cxId = getUUIDFrom("query", req, "cxId").orFail();
    const id = getFromParamsOrFail("id", req);
    const patient = await getPatientReadOnlyOrFail({ cxId, patientId: id });
    return res.status(status.OK).json(patient.data.consolidatedLinkDemographics ?? null);
  })
);

/** ---------------------------------------------------------------------------
 * GET /internal/patient/:id/customer
 *
 * Returns the customer ID and organization details for the specified patient.
 *
 * @param req.params.id The patient ID.
 * @return The customer ID, organization name, and location.
 */
router.get(
  "/:id/customer",
  handleParams,
  requestLogger,
  asyncHandler(async (req: Request, res: Response) => {
    const id = getFromParamsOrFail("id", req);
    const patient = await internalOnlyGetPatientReadOnlyByIdOrFail(id);
    const cxId = patient.cxId;
    const organizations = await getOrganizations({ cxIds: [cxId] });
    const organization = organizations[0];
    if (!organization) {
      throw new NotFoundError("Organization not found for patient");
    }
    const data = organization.data;
    return res.status(status.OK).json({ cxId, name: data.name, location: data.location });
  })
);

/** ---------------------------------------------------------------------------
 * GET /internal/patient/:id
 *
 * Returns a patient given a specific customer and patient IDs
 *
 * @param req.query.cxId The customer ID.
 * @param req.params.id The patient ID.
 * @param req.query.includeAugmentationDemographics Optional. If true, augments patient demographics with consolidated link demographics.
 * @return A patient.
 */
router.get(
  "/:id",
  handleParams,
  requestLogger,
  asyncHandler(async (req: Request, res: Response) => {
    const cxId = getUUIDFrom("query", req, "cxId").orFail();
    const id = getFromParamsOrFail("id", req);
    const includeAugmentationDemographics =
      getFromQueryAsBoolean("includeAugmentationDemographics", req) ?? false;

    let patient = await getPatientReadOnlyOrFail({ cxId, patientId: id });
    if (includeAugmentationDemographics) {
      const augmentedPatient = createAugmentedPatient(patient);
      patient = augmentedPatient;
    }
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
    const forcePd = getFromQueryAsBoolean("forcePd", req);
    const patient = await getPatientOrFail({ cxId, id });
    const facilityId = patient.facilityIds[0];

    await runOrSchedulePatientDiscoveryAcrossHies({
      patient,
      facilityId,
      rerunPdOnNewDemographics,
      requestId,
      forcePd,
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
 * For network query flow (requestId in network_query_request view):
 * - Updates the network query status to "completed"
 * - Sends the network query webhook (handled by updateDatasourceQueryStatusByRequestId)
 *
 * For legacy document query flow (requestId not in network_query_request view):
 * - Sends the consolidated data webhook via getConsolidatedAndSendToCx
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

    // Check if this is a network query flow or legacy document query flow
    const networkQuery = await getNetworkQueryStatusByRequestId({ cxId, requestId });

    if (networkQuery) {
      // Update status to "completed" and send the network query webhook
      log(`Network query found, updating status to completed`);
      updateDatasourceQueryStatusByRequestId({
        cxId,
        requestId,
        source: "hie",
        specificSource: hieSpecificSource,
        toStatus: DatasourceQueryStatus.Completed,
      }).catch(
        processAsyncError("POST /internal/patient/:id/consolidated, updateNetworkQueryStatus")
      );
    } else {
      log(`Network query not found, sending consolidated data webhook`);
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
    }

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
    const contextId = getFromQuery("contextId", req);
    const rerunPdOnNewDemographics = stringToBoolean(
      getFrom("query").optional("rerunPdOnNewDemographics", req)
    );
    const forceCommonwell = stringToBoolean(getFrom("query").optional("commonwell", req));
    const forceCarequality = stringToBoolean(getFrom("query").optional("carequality", req));
    const runPd = getFromQueryAsBoolean("runPd", req) ?? false;
    const payload = patientCreateSchema.parse(req.body);
    const { cohorts: cohortIds, ...patientCreateProps } = payload;

    const patientCreate: PatientCreateCmd = {
      ...schemaCreateToPatientData(patientCreateProps),
      cxId,
      facilityId,
    };
    const { patient, created } = await createOrUpdatePatientBasedOnDemo({
      patientCreate,
      runPd,
      rerunPdOnNewDemographics,
      forceCommonwell,
      forceCarequality,
      cohortIds,
      contextId,
    });

    return res.status(created ? status.CREATED : status.OK).json(dtoFromModel(patient));
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
 * @param req.query.isSendWebhook - whether to send the webhook. Optional.
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

/** ---------------------------------------------------------------------------
 * GET /internal/patient/:id/cohort
 *
 * Returns a list of all cohorts the patient is a member of.
 *
 * @param req.query.cxId The customer ID.
 * @param req.params.id The ID of the patient whose cohorts are to be returned.
 * @returns The cohorts for the patient.
 */
router.get(
  "/:id/cohort",
  handleParams,
  requestLogger,
  asyncHandler(async (req: Request, res: Response) => {
    const cxId = getUUIDFrom("query", req, "cxId").orFail();
    const patientId = getFromParamsOrFail("id", req);

    await getPatientOrFail({ id: patientId, cxId });

    const cohortsWithSizes = await listCohortsWithSizesForPatient({ cxId, patientId });

    return res.status(status.OK).json({ cohorts: cohortsWithSizes });
  })
);

/**
 * POST /internal/patient/:id/cohort
 *
 * Add a patient to multiple cohorts.
 *
 * @param req.params.id The ID of the patient to add to cohorts.
 * @param req.query.cxId The customer ID.
 * @param req.body.cohortIds The list of cohort IDs to add the patient to.
 */
router.post(
  "/:id/cohort",
  handleParams,
  requestLogger,
  asyncHandler(async (req: Request, res: Response) => {
    const cxId = getUUIDFrom("query", req, "cxId").orFail();
    const patientId = getFromParamsOrFail("id", req);
    const { cohortIds } = cohortIdsSchema.parse(req.body);

    await getPatientOrFail({ id: patientId, cxId });

    await addPatientToCohorts({
      cxId,
      patientId,
      cohortIds,
    });

    const cohortsWithSizes = await listCohortsWithSizesForPatient({ cxId, patientId });

    return res.status(status.CREATED).json({ cohorts: cohortsWithSizes });
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

const sourceNetworkSchema = z.nativeEnum(MedicalDataSource);

/**
 * GET /internal/patient/:id/state
 *
 * Retrieves the patient state for a given patient and network.
 * @param req.params.id The patient ID.
 * @param req.query.cxId The customer ID.
 * @param req.query.network The network.
 * @param req.query.requestId The request ID. Optional. If not provided, the most recent patient state will be returned.
 * @param req.query.isConsiderConversion Whether to consider the conversion status in the overall status. Optional. Defaults to true.
 * @returns The patient state.
 */
router.get(
  "/:id/state",
  requestLogger,
  asyncHandler(async (req: Request, res: Response) => {
    if (Config.isSandbox()) return res.sendStatus(status.NOT_IMPLEMENTED);

    const patientId = getUUIDFrom("params", req, "id").orFail();
    const cxId = getUUIDFrom("query", req, "cxId").orFail();
    const patient = await getPatientOrFail({ cxId, id: patientId });
    const requestId = getUUIDFrom("query", req, "requestId").optional();
    const isConsiderConversion = getFromQueryAsBoolean("isConsiderConversion", req);
    const networkRaw = getFromQueryOrFail("network", req);
    const network = sourceNetworkSchema.parse(networkRaw);

    const patientState = await getPatientStateWithOverallStatus({
      patientId: patient.id,
      cxId: patient.cxId,
      network,
      requestId,
      isConsiderConversion,
    });
    return res.status(status.OK).json({ patientState });
  })
);

export default router;

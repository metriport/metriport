import { demographicsSchema, patientCreateSchema } from "@metriport/api-sdk";
import { out } from "@metriport/core/util/log";
import {
  BadRequestError,
  NotFoundError,
  PaginatedResponse,
  stringToBoolean,
} from "@metriport/shared";
import dayjs from "dayjs";
import duration from "dayjs/plugin/duration";
import { Request, Response } from "express";
import Router from "express-promise-router";
import httpStatus from "http-status";
import { createPatient, PatientCreateCmd } from "../../command/medical/patient/create-patient";
import {
  getPatientByExternalId,
  getPatientOrFail,
  getPatients,
  getPatientsCount,
  matchPatient,
} from "../../command/medical/patient/get-patient";
import { createPatientImportJob } from "../../command/medical/patient/patient-import-create-job";
import { Pagination } from "../../command/pagination";
import { getSandboxPatientLimitForCx } from "../../domain/medical/get-patient-limit";
import { isPatientMappingSource, PatientMappingSource } from "../../domain/patient-mapping";
import { Config } from "../../shared/config";
import { requestLogger } from "../helpers/request-logger";
import { checkRateLimit } from "../middlewares/rate-limiting";
import { isPaginated, paginated } from "../pagination";
import {
  asyncHandler,
  getCxIdOrFail,
  getFrom,
  getFromQuery,
  getFromQueryAsBoolean,
  getFromQueryOrFail,
} from "../util";
import { PatientImportDto } from "./dtos/patient-import";
import { dtoFromModel, PatientDTO } from "./dtos/patientDTO";
import { schemaCreateToPatientData, schemaDemographicsToPatientData } from "./schemas/patient";

dayjs.extend(duration);

const router = Router();

/** ---------------------------------------------------------------------------
 * POST /patient
 *
 * Creates the patient corresponding to the specified facility at the
 * customer's organization if it doesn't exist already.
 *
 * @param  req.query.facilityId The ID of the Facility the Patient should be associated with.
 * @return The newly created patient.
 */
router.post(
  "/",
  checkRateLimit("patientCreateOrUpdate"),
  requestLogger,
  asyncHandler(async (req: Request, res: Response) => {
    const cxId = getCxIdOrFail(req);
    const facilityId = getFromQueryOrFail("facilityId", req);
    const rerunPdOnNewDemographics = stringToBoolean(
      getFrom("query").optional("rerunPdOnNewDemographics", req)
    );
    const forceCommonwell = stringToBoolean(getFrom("query").optional("commonwell", req));
    const forceCarequality = stringToBoolean(getFrom("query").optional("carequality", req));
    const payload = patientCreateSchema.parse(req.body);
    const { settings, ...patientCreateProps } = payload;

    if (Config.isSandbox()) {
      // limit the amount of patients that can be created in sandbox mode
      const numPatients = await getPatientsCount({ cxId });
      const patientLimit = await getSandboxPatientLimitForCx(cxId);
      if (numPatients >= patientLimit) {
        return res.status(httpStatus.BAD_REQUEST).json({
          message: `Cannot create more than ${Config.SANDBOX_PATIENT_LIMIT} patients in Sandbox mode!`,
        });
      }
    }

    const patientCreate: PatientCreateCmd = {
      ...schemaCreateToPatientData(patientCreateProps),
      cxId,
      facilityId,
    };

    const patient = await createPatient({
      patient: patientCreate,
      rerunPdOnNewDemographics,
      forceCommonwell,
      forceCarequality,
      settings,
    });

    return res.status(httpStatus.CREATED).json(dtoFromModel(patient));
  })
);

/** ---------------------------------------------------------------------------
 * GET /patient
 *
 * Gets all patients corresponding to the specified facility at the customer's organization.
 *
 * @param   req.cxId              The customer ID.
 * @param   req.query.facilityId  The ID of the facility the user patient is associated with (optional).
 * @param   req.query.filters     Full text search filters. See https://docs.metriport.com/medical-api/more-info/search-filters
 * @param   req.query.fromItem    The minimum item to be included in the response, inclusive.
 * @param   req.query.toItem      The maximum item to be included in the response, inclusive.
 * @param   req.query.count       The number of items to be included in the response.
 * @returns An object containing:
 * - `patients` - A single page containing the patients corresponding to the given facility.
 * - `meta` - Pagination information, including how to get to the next page.
 */
router.get(
  "/",
  requestLogger,
  asyncHandler(async (req: Request, res: Response) => {
    const cxId = getCxIdOrFail(req);
    const facilityId = getFrom("query").optional("facilityId", req);
    const fullTextSearchFilters = getFrom("query").optional("filters", req);

    // TODO 483 remove this (and respected conditional) once pagination is fully rolled out
    if (!isPaginated(req)) {
      out(`List patients - cx ${cxId}`).log(`Running without pagination`);
      const patients = await getPatients({ cxId, facilityId: facilityId, fullTextSearchFilters });
      const patientsData = patients.map(dtoFromModel);
      return res.status(httpStatus.OK).json({ patients: patientsData });
    }

    const queryParams = {
      ...(facilityId ? { facilityId } : {}),
      ...(fullTextSearchFilters ? { filters: fullTextSearchFilters } : {}),
    };

    const { meta, items } = await paginated({
      request: req,
      additionalQueryParams: queryParams,
      getItems: (pagination: Pagination) =>
        getPatients({ cxId, facilityId, pagination, fullTextSearchFilters }),
      getTotalCount: () => getPatientsCount({ cxId, facilityId, fullTextSearchFilters }),
    });
    const response: PaginatedResponse<PatientDTO, "patients"> = {
      meta,
      patients: items.map(dtoFromModel),
    };
    return res.status(httpStatus.OK).json(response);
  })
);

/** ---------------------------------------------------------------------------
 * POST /patient/match
 *
 * Searches for a patient previously created at Metriport, based on a demographic data. Returns the matched patient, if it exists.
 *
 * @return The matched patient.
 * @throws NotFoundError if the patient does not exist.
 */
router.post(
  "/match",
  requestLogger,
  asyncHandler(async (req: Request, res: Response) => {
    const cxId = getCxIdOrFail(req);
    const payload = demographicsSchema.parse(req.body);

    const patientData = schemaDemographicsToPatientData(payload);

    const patient = await matchPatient({ cxId, ...patientData });

    if (patient) {
      // Authorization
      await getPatientOrFail({ cxId, id: patient.id });
      return res.status(httpStatus.OK).json(dtoFromModel(patient));
    }
    throw new NotFoundError("Cannot find patient");
  })
);

/** ---------------------------------------------------------------------------
 * GET /patient/external-id
 *
 * Searches for a patient previously created at Metriport, based on an external ID. Returns the matched patient, if it exists.
 *
 * @return The matched patient.
 * @throws NotFoundError if the patient does not exist.
 */
router.get(
  "/external-id",
  requestLogger,
  asyncHandler(async (req: Request, res: Response) => {
    const cxId = getCxIdOrFail(req);
    const externalId = getFromQueryOrFail("externalId", req);
    const source = getFromQuery("source", req);
    if (source && !isPatientMappingSource(source)) {
      throw new BadRequestError("Invalid source", undefined, { source });
    }

    const patient = await getPatientByExternalId({
      cxId,
      externalId,
      ...(source ? { source: source as PatientMappingSource } : {}),
    });

    if (patient) return res.status(httpStatus.OK).json(dtoFromModel(patient));
    throw new NotFoundError("Cannot find patient");
  })
);

/** ---------------------------------------------------------------------------
 * POST /patient/bulk
 *
 * Initiates a bulk patient create.
 *
 * @param req.query.facilityId The ID of the Facility the Patients should be associated with
 *        (optional if there's only one facility for the customer, fails if not provided and
 *        there's more than one facility for the customer).
 * @param req.query.dryRun Whether to simply validate the bundle or actually import it (optional,
 *        defaults to false).
 * @returns an object containing the information about the bulk import job:s
 * - `requestId` - the bulk import request ID
 * - `facilityId` - the facility ID used to create the patients
 * - `status` - the status of the bulk import job
 * - `uploadUrl` - the URL to upload the CSV file
 * - `params` - the parameters used to initiate the bulk patient create
 */
router.post(
  "/bulk",
  // TODO add this if/when we need to rate limit this endpoint
  // checkRateLimit("..."),
  requestLogger,
  asyncHandler(async (req: Request, res: Response) => {
    const cxId = getCxIdOrFail(req);
    const facilityIdParam = getFromQuery("facilityId", req);
    const dryRun = getFromQueryAsBoolean("dryRun", req);

    const patientImportResponse = await createPatientImportJob({
      cxId,
      facilityId: facilityIdParam,
      dryRun,
    });

    const { jobId, facilityId, status, uploadUrl, params } = patientImportResponse;
    const respPayload: PatientImportDto = {
      requestId: jobId,
      facilityId,
      status,
      uploadUrl,
      params,
    };
    return res.status(httpStatus.OK).json(respPayload);
  })
);

export default router;

import {
  AllergyIntolerance,
  Coding,
  Condition,
  Immunization,
  Observation,
  Procedure,
} from "@medplum/fhirtypes";
import {
  BadRequestError,
  errorToString,
  JwtTokenInfo,
  MetriportError,
  NotFoundError,
  sleep,
  toTitleCase,
} from "@metriport/shared";
import { buildDayjs } from "@metriport/shared/common/date";
import {
  AllergenReference,
  AllergenReferences,
  allergenReferencesSchema,
  Allergy,
  AllergyListResponse,
  allergyListResponseSchema,
  AllergyReactionReference,
  AllergyReactionReferences,
  allergyReactionReferencesSchema,
  AllergySeverityReference,
  AllergySeverityReferences,
  allergySeverityReferencesSchema,
  AppointmentEvent,
  AppointmentEventListResponse,
  appointmentEventListResponseSchema,
  athenaClientJwtTokenResponseSchema,
  BookedAppointment,
  BookedAppointmentListResponse,
  bookedAppointmentListResponseSchema,
  bookedAppointmentSchema,
  CreatedAllergy,
  createdAllergySchema,
  CreatedAllergySuccess,
  createdAllergySuccessSchema,
  CreatedClinicalDocument,
  createdClinicalDocumentSchema,
  CreatedClinicalDocumentSuccess,
  createdClinicalDocumentSuccessSchema,
  CreatedLabResult,
  createdLabResultSchema,
  CreatedLabResultSuccess,
  createdLabResultSuccessSchema,
  CreatedMedication,
  createdMedicationSchema,
  CreatedMedicationSuccess,
  createdMedicationSuccessSchema,
  CreatedProblem,
  createdProblemSchema,
  CreatedProblemSuccess,
  createdProblemSuccessSchema,
  CreatedSubscription,
  createdSubscriptionSchema,
  CreatedSubscriptionSuccess,
  createdSubscriptionSuccessSchema,
  CreatedSurgicalHistory,
  createdSurgicalHistorySchema,
  CreatedSurgicalHistorySuccess,
  createdSurgicalHistorySuccessSchema,
  CreatedVaccines,
  createdVaccinesSchema,
  CreatedVaccinesSuccess,
  createdVaccinesSuccessSchema,
  CreatedVitals,
  createdVitalsSchema,
  CreatedVitalsSuccess,
  createdVitalsSuccessSchema,
  Departments,
  departmentsSchema,
  EventType,
  FeedType,
  MedicationCreateParams,
  MedicationReference,
  MedicationReferences,
  medicationReferencesSchema,
  PatientCustomField,
  PatientsCustomFields,
  patientsCustomFieldsSchema,
  VitalsCreateParams,
} from "@metriport/shared/interface/external/ehr/athenahealth/index";
import {
  Patient,
  patientSchema,
  PatientSearch,
  patientSearchSchema,
} from "@metriport/shared/interface/external/ehr/patient";
import { EhrSources } from "@metriport/shared/interface/external/ehr/source";
import { getObservationUnits } from "@metriport/shared/medical";
import axios, { AxiosInstance } from "axios";
import dayjs from "dayjs";
import duration from "dayjs/plugin/duration";
import jaroWinkler from "jaro-winkler";
import { uniqBy } from "lodash";
import { executeAsynchronously } from "../../../util/concurrency";
import { out } from "../../../util/log";
import { capture } from "../../../util/notifications";
import {
  ApiConfig,
  createDataParams,
  DataPoint,
  formatDate,
  getAllergyIntoleranceManifestationSnomedCoding,
  getAllergyIntoleranceOnsetDate,
  getAllergyIntoleranceSubstanceRxnormCoding,
  getConditionSnomedCode,
  getConditionStartDate,
  getConditionStatus,
  getImmunizationAdministerDate,
  getImmunizationCvxCode,
  getMedicationRxnormCoding,
  getMedicationStatementStartDate,
  getObservationInterpretation,
  getObservationLoincCode,
  getObservationLoincCoding,
  getObservationObservedDate,
  getObservationReferenceRange,
  getObservationResultStatus,
  getObservationUnitAndValue,
  getProcedureCptCode,
  getProcedurePerformedDate,
  GroupedVitals,
  makeRequest,
  MakeRequestParamsInEhr,
  MedicationWithRefs,
  paginateWaitTime,
} from "../shared";

dayjs.extend(duration);

const parallelRequests = 5;
const delayBetweenRequestBatches = dayjs.duration(2, "seconds");

interface AthenaHealthApiConfig extends ApiConfig {
  environment: AthenaEnv;
}

const athenaPracticePrefix = "Practice";
const athenaPatientPrefix = "E";
const athenaDepartmentPrefix = "Department";
const athenaDateFormat = "MM/DD/YYYY";
const athenaDateTimeFormat = "MM/DD/YYYY HH:mm:ss";
const labResultDocumentId = "386265";
const clinicalNoteDocumentSubclass = "CLINICALDOCUMENT";
const clinicalNoteDocumentId = "423482";
const minAllowedSimilarity = 0.8;

const athenaEnv = ["api", "api.preview"] as const;
export type AthenaEnv = (typeof athenaEnv)[number];
export function isAthenaEnv(env: string): env is AthenaEnv {
  return athenaEnv.includes(env as AthenaEnv);
}

const problemStatusesMap = new Map<string, string>();
problemStatusesMap.set("relapse", "CHRONIC");
problemStatusesMap.set("recurrence", "CHRONIC");

const vitalSignCodesMapAthena = new Map<string, string>();
vitalSignCodesMapAthena.set("8310-5", "VITALS.TEMPERATURE");
vitalSignCodesMapAthena.set("8867-4", "VITALS.HEARTRATE");
vitalSignCodesMapAthena.set("9279-1", "VITALS.RESPIRATIONRATE");
vitalSignCodesMapAthena.set("2708-6", "VITALS.INHALEDO2CONCENTRATION");
vitalSignCodesMapAthena.set("8462-4", "VITALS.BLOODPRESSURE.DIASTOLIC");
vitalSignCodesMapAthena.set("8480-6", "VITALS.BLOODPRESSURE.SYSTOLIC");
vitalSignCodesMapAthena.set("29463-7", "VITALS.WEIGHT");
vitalSignCodesMapAthena.set("8302-2", "VITALS.HEIGHT");
vitalSignCodesMapAthena.set("39156-5", "VITALS.BMI");

const clinicalElementsThatRequireUnits = ["VITALS.WEIGHT", "VITALS.HEIGHT", "VITALS.TEMPERATURE"];

const validObservationResultStatuses = [
  "final",
  "corrected",
  "pending",
  "preliminary",
  "unverified",
  "deleted",
  "unsolicited",
];

const lbsToG = 453.592;
const kgToG = 1000;
const inchesToCm = 2.54;

class AthenaHealthApi {
  private axiosInstanceFhir: AxiosInstance;
  private axiosInstanceProprietary: AxiosInstance;
  private baseUrl: string;
  private twoLeggedAuthTokenInfo: JwtTokenInfo | undefined;
  private practiceId: string;

  private constructor(private config: AthenaHealthApiConfig) {
    this.twoLeggedAuthTokenInfo = config.twoLeggedAuthTokenInfo;
    this.practiceId = this.stripPracticeId(config.practiceId);
    this.axiosInstanceFhir = axios.create({});
    this.axiosInstanceProprietary = axios.create({});
    this.baseUrl = `https://${config.environment}.platform.athenahealth.com`;
  }

  public static async create(config: AthenaHealthApiConfig): Promise<AthenaHealthApi> {
    const instance = new AthenaHealthApi(config);
    await instance.initialize();
    return instance;
  }

  getTwoLeggedAuthTokenInfo(): JwtTokenInfo | undefined {
    return this.twoLeggedAuthTokenInfo;
  }

  private async fetchTwoLeggedAuthToken(): Promise<JwtTokenInfo> {
    const url = `${this.baseUrl}/oauth2/v1/token`;
    const data = {
      grant_type: "client_credentials",
      scope: "athena/service/Athenanet.MDP.* system/Patient.read",
    };

    try {
      const response = await axios.post(url, createDataParams(data), {
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        auth: {
          username: this.config.clientKey,
          password: this.config.clientSecret,
        },
      });
      if (!response.data) throw new MetriportError("No body returned from token endpoint");
      const tokenData = athenaClientJwtTokenResponseSchema.parse(response.data);
      return {
        access_token: tokenData.access_token,
        exp: new Date(Date.now() + +tokenData.expires_in * 1000),
      };
    } catch (error) {
      throw new MetriportError("Failed to fetch Two Legged Auth token @ AthenaHealth", undefined, {
        error: errorToString(error),
      });
    }
  }

  async initialize(): Promise<void> {
    const { log } = out(`AthenaHealth initialize - practiceId ${this.practiceId}`);
    if (!this.twoLeggedAuthTokenInfo) {
      log(`Two Legged Auth token not found @ AthenaHealth - fetching new token`);
      this.twoLeggedAuthTokenInfo = await this.fetchTwoLeggedAuthToken();
    } else if (this.twoLeggedAuthTokenInfo.exp < buildDayjs().add(15, "minutes").toDate()) {
      log(`Two Legged Auth token expired @ AthenaHealth - fetching new token`);
      this.twoLeggedAuthTokenInfo = await this.fetchTwoLeggedAuthToken();
    } else {
      log(`Two Legged Auth token found @ AthenaHealth - using existing token`);
    }

    const headers = {
      Authorization: `Bearer ${this.twoLeggedAuthTokenInfo.access_token}`,
      "Content-Type": "application/x-www-form-urlencoded",
    };

    this.axiosInstanceFhir = axios.create({
      baseURL: `${this.baseUrl}/fhir/r4`,
      headers: { ...headers, accept: "application/json" },
    });

    this.axiosInstanceProprietary = axios.create({
      baseURL: `${this.baseUrl}/v1/${this.practiceId}`,
      headers,
    });
  }

  async getDepartmentIds(cxId: string): Promise<string[]> {
    const { debug } = out(
      `AthenaHealth getDepartmentIds - cxId ${cxId} practiceId ${this.practiceId}`
    );
    const departmentsUrl = "/departments";
    const additionalInfo = { cxId, practiceId: this.practiceId };
    const departments = await this.makeRequest<Departments>({
      cxId,
      s3Path: "departments",
      method: "GET",
      url: departmentsUrl,
      schema: departmentsSchema,
      additionalInfo,
      debug,
    });
    return departments.departments.map(d => d.departmentid);
  }

  async getPatient({ cxId, patientId }: { cxId: string; patientId: string }): Promise<Patient> {
    const { debug } = out(
      `AthenaHealth getPatient - cxId ${cxId} practiceId ${this.practiceId} patientId ${patientId}`
    );
    const patientUrl = `/Patient/${this.createPatientId(patientId)}`;
    const additionalInfo = { cxId, practiceId: this.practiceId, patientId };
    const patient = await this.makeRequest<Patient>({
      cxId,
      patientId,
      s3Path: "patient",
      method: "GET",
      url: patientUrl,
      schema: patientSchema,
      additionalInfo,
      debug,
      useFhir: true,
    });
    return patient;
  }

  async searchPatient({ cxId, patientId }: { cxId: string; patientId: string }): Promise<Patient> {
    const { debug } = out(
      `AthenaHealth searchPatient - cxId ${cxId} practiceId ${this.practiceId} patientId ${patientId}`
    );
    const patientSearchUrl = "/Patient/_search";
    const additionalInfo = { cxId, practiceId: this.practiceId, patientId };
    const data = {
      _id: this.createPatientId(patientId),
      "ah-practice": this.createPracticetId(this.practiceId),
    };
    const patientSearch = await this.makeRequest<PatientSearch>({
      cxId,
      patientId,
      s3Path: "patient-search",
      method: "POST",
      data,
      url: patientSearchUrl,
      schema: patientSearchSchema,
      additionalInfo,
      debug,
      useFhir: true,
    });
    const entry = patientSearch.entry;
    if (!entry) {
      throw new BadRequestError("Search array undefined", undefined, {
        ...additionalInfo,
        patientSearch: JSON.stringify(patientSearch),
      });
    }
    if (entry.length > 1) {
      throw new BadRequestError("Multiple entries found in search array", undefined, {
        ...additionalInfo,
        patientSearch: entry.map(e => JSON.stringify(e)).join(","),
      });
    }
    const patient = entry[0]?.resource;
    if (!patient) throw new NotFoundError("Patient not found", undefined, additionalInfo);
    return patient;
  }

  async getAllergyForPatient({
    cxId,
    patientId,
    departmentId,
    allergenId,
  }: {
    cxId: string;
    patientId: string;
    departmentId: string;
    allergenId: string;
  }): Promise<Allergy | undefined> {
    const { debug } = out(
      `AthenaHealth getAllergyForPatient - cxId ${cxId} practiceId ${this.practiceId} patientId ${patientId}`
    );
    const params = { departmentid: this.stripDepartmentId(departmentId) };
    const queryParams = new URLSearchParams(params);
    const allergiesUrl = `/chart/${this.stripPatientId(
      patientId
    )}/allergies?${queryParams.toString()}`;
    const additionalInfo = { cxId, practiceId: this.practiceId, patientId };
    const allergyListResponse = await this.makeRequest<AllergyListResponse>({
      cxId,
      patientId,
      s3Path: "allergies",
      method: "GET",
      url: allergiesUrl,
      schema: allergyListResponseSchema,
      additionalInfo,
      debug,
    });
    const allergy = allergyListResponse.allergies.find(a => a.allergenid === allergenId);
    return allergy;
  }

  async getCustomFieldsForPatient({
    cxId,
    patientId,
    departmentId,
  }: {
    cxId: string;
    patientId: string;
    departmentId: string;
  }): Promise<PatientCustomField[]> {
    const { debug } = out(
      `AthenaHealth getCustomFieldsForPatient - cxId ${cxId} practiceId ${this.practiceId} patientId ${patientId}`
    );
    const params = {
      showprivacycustomfields: "true",
      showcustomfields: "true",
      departmentid: this.stripDepartmentId(departmentId),
    };
    const queryParams = new URLSearchParams(params);
    const patientsUrl = `/patients/${this.stripPatientId(patientId)}?${queryParams.toString()}`;
    const additionalInfo = { cxId, practiceId: this.practiceId, patientId };
    const patientsCustomFields = await this.makeRequest<PatientsCustomFields>({
      cxId,
      patientId,
      s3Path: "patients-athena-one",
      method: "GET",
      url: patientsUrl,
      schema: patientsCustomFieldsSchema,
      additionalInfo,
      debug,
    });
    if (patientsCustomFields.length > 1) {
      throw new BadRequestError("Multiple patients found in athena-one patients array", undefined, {
        ...additionalInfo,
        patientsCustomFields: patientsCustomFields.map(p => JSON.stringify(p)).join(","),
      });
    }
    const patientCustomFields = patientsCustomFields[0]?.customfields;
    if (!patientCustomFields)
      throw new NotFoundError("Patient not found", undefined, additionalInfo);
    return patientCustomFields;
  }

  async createProblem({
    cxId,
    patientId,
    departmentId,
    condition,
  }: {
    cxId: string;
    patientId: string;
    departmentId: string;
    condition: Condition;
  }): Promise<CreatedProblemSuccess> {
    const { debug } = out(
      `AthenaHealth createProblem - cxId ${cxId} practiceId ${this.practiceId} patientId ${patientId} departmentId ${departmentId}`
    );
    const chartProblemUrl = `/chart/${this.stripPatientId(patientId)}/problems`;
    const additionalInfo = {
      cxId,
      practiceId: this.practiceId,
      patientId,
      departmentId,
      conditionId: condition.id,
    };
    const snomedCode = getConditionSnomedCode(condition);
    if (!snomedCode) {
      throw new BadRequestError("No SNOMED code found for condition", undefined, additionalInfo);
    }
    const startDate = getConditionStartDate(condition);
    if (!startDate) {
      throw new BadRequestError("No start date found for condition", undefined, additionalInfo);
    }
    const conditionStatus = getConditionStatus(condition);
    const problemStatus = conditionStatus
      ? problemStatusesMap.get(conditionStatus.toLowerCase())
      : undefined;
    const data = {
      departmentid: this.stripDepartmentId(departmentId),
      note: "Added via Metriport App",
      snomedcode: snomedCode,
      startdate: this.formatDate(startDate),
      status: problemStatus,
      THIRDPARTYUSERNAME: undefined,
      PATIENTFACINGCALL: undefined,
    };
    const createdProblem = await this.makeRequest<CreatedProblem>({
      cxId,
      patientId,
      s3Path: `chart/problem/${additionalInfo.conditionId ?? "unknown"}`,
      method: "POST",
      data,
      url: chartProblemUrl,
      schema: createdProblemSchema,
      additionalInfo,
      debug,
    });
    if (!createdProblem.success || !createdProblem.problemid) {
      throw new MetriportError("Problem creation failed", undefined, {
        ...additionalInfo,
        error: createdProblem.errormessage,
      });
    }
    return createdProblemSuccessSchema.parse(createdProblem);
  }

  async createMedicationWithStatements({
    cxId,
    patientId,
    departmentId,
    medicationWithRefs,
  }: {
    cxId: string;
    patientId: string;
    departmentId: string;
    medicationWithRefs: MedicationWithRefs;
  }): Promise<CreatedMedicationSuccess[]> {
    const { log, debug } = out(
      `AthenaHealth createMedicationWithStatements - cxId ${cxId} practiceId ${this.practiceId} patientId ${patientId} departmentId ${departmentId}`
    );
    const chartMedicationUrl = `/chart/${this.stripPatientId(patientId)}/medications`;
    const additionalInfo = {
      cxId,
      practiceId: this.practiceId,
      patientId,
      departmentId,
      medicationId: medicationWithRefs.medication.id,
    };
    if (medicationWithRefs.statement.length < 1) {
      throw new BadRequestError("No medication statements found", undefined, additionalInfo);
    }
    const dates = medicationWithRefs.statement.flatMap(statement => {
      const startdate = getMedicationStatementStartDate(statement);
      if (!startdate) return [];
      const stopdate = statement.effectivePeriod?.end;
      return { startdate, stopdate };
    });
    if (dates.length < 1) {
      throw new BadRequestError(
        "No start dates found for medication statements",
        undefined,
        additionalInfo
      );
    }
    const rxnormCoding = getMedicationRxnormCoding(medicationWithRefs.medication);
    if (!rxnormCoding) {
      throw new BadRequestError("No RXNORM code found for medication", undefined, additionalInfo);
    }
    const medicationReference = await this.searchForMedication({
      cxId,
      patientId,
      coding: rxnormCoding,
    });
    if (!medicationReference) {
      throw new BadRequestError("No medication option found via search", undefined, additionalInfo);
    }
    const sharedData = {
      departmentid: this.stripDepartmentId(departmentId),
      providernote: "Added via Metriport App",
      unstructuredsig: "Metriport",
      medicationid: medicationReference.medicationid,
      hidden: false,
      stopreason: undefined,
      patientnote: undefined,
      THIRDPARTYUSERNAME: undefined,
      PATIENTFACINGCALL: undefined,
    };
    const allCreatedMedications: CreatedMedicationSuccess[] = [];
    const createMedicationErrors: { error: unknown; medication: string }[] = [];
    const createMedicationArgs: MedicationCreateParams[] = dates.map(d => ({
      ...sharedData,
      startdate: this.formatDate(d.startdate),
      stopdate: this.formatDate(d.stopdate),
    }));
    await executeAsynchronously(
      createMedicationArgs,
      async (params: MedicationCreateParams) => {
        try {
          const createdMedication = await this.makeRequest<CreatedMedication>({
            cxId,
            patientId,
            s3Path: `chart/medication/${additionalInfo.medicationId ?? "unknown"}`,
            method: "POST",
            data: params,
            url: chartMedicationUrl,
            schema: createdMedicationSchema,
            additionalInfo,
            debug,
          });
          if (!createdMedication.success || !createdMedication.medicationentryid) {
            throw new MetriportError("Medication creation failed", undefined, {
              ...additionalInfo,
              error: createdMedication.errormessage,
            });
          }
          allCreatedMedications.push(createdMedicationSuccessSchema.parse(createdMedication));
        } catch (error) {
          if (error instanceof BadRequestError || error instanceof NotFoundError) return;
          const medicationToString = JSON.stringify(params);
          log(`Failed to create medication ${medicationToString}. Cause: ${errorToString(error)}`);
          createMedicationErrors.push({ error, ...params, medication: medicationToString });
        }
      },
      {
        numberOfParallelExecutions: parallelRequests,
        delay: delayBetweenRequestBatches.asMilliseconds(),
      }
    );
    if (createMedicationErrors.length > 0) {
      const msg = `Failure while creating some medications @ AthenaHealth`;
      capture.message(msg, {
        extra: {
          ...additionalInfo,
          createMedicationArgsCount: createMedicationArgs.length,
          createMedicationErrorsCount: createMedicationErrors.length,
          errors: createMedicationErrors,
          context: "athenahealth.create-medication",
        },
        level: "warning",
      });
    }
    return allCreatedMedications;
  }

  async createVaccine({
    cxId,
    patientId,
    departmentId,
    immunization,
  }: {
    cxId: string;
    patientId: string;
    departmentId: string;
    immunization: Immunization;
  }): Promise<CreatedVaccinesSuccess> {
    const { debug } = out(
      `AthenaHealth createVaccine - cxId ${cxId} practiceId ${this.practiceId} patientId ${patientId} departmentId ${departmentId}`
    );
    const chartVaccineUrl = `/chart/${this.stripPatientId(patientId)}/vaccines`;
    const additionalInfo = {
      cxId,
      practiceId: this.practiceId,
      patientId,
      departmentId,
      immunizationId: immunization.id,
    };
    const cvxCode = getImmunizationCvxCode(immunization);
    if (!cvxCode) {
      throw new BadRequestError("No CVX code found for immunization", undefined, additionalInfo);
    }
    const administeredDate = getImmunizationAdministerDate(immunization);
    if (!administeredDate) {
      throw new BadRequestError(
        "No administer date found for immunization",
        undefined,
        additionalInfo
      );
    }
    const data = {
      departmentid: this.stripDepartmentId(departmentId),
      cvx: cvxCode,
      administerdate: this.formatDate(administeredDate),
      THIRDPARTYUSERNAME: undefined,
      PATIENTFACINGCALL: undefined,
    };
    const createdVaccines = await this.makeRequest<CreatedVaccines>({
      cxId,
      patientId,
      s3Path: `chart/vaccine/${additionalInfo.immunizationId ?? "unknown"}`,
      method: "POST",
      data,
      url: chartVaccineUrl,
      schema: createdVaccinesSchema,
      additionalInfo,
      debug,
    });
    if (!createdVaccines.vaccineids || createdVaccines.vaccineids.length < 1) {
      throw new MetriportError("Vaccine creation failed", undefined, {
        ...additionalInfo,
        error: "No vaccine ids returned",
      });
    }
    return createdVaccinesSuccessSchema.parse(createdVaccines);
  }

  async createSurgicalHistory({
    cxId,
    patientId,
    departmentId,
    procedure,
  }: {
    cxId: string;
    patientId: string;
    departmentId: string;
    procedure: Procedure;
  }): Promise<CreatedSurgicalHistorySuccess> {
    const { debug } = out(
      `AthenaHealth createSurgicalHistory - cxId ${cxId} practiceId ${this.practiceId} patientId ${patientId} departmentId ${departmentId}`
    );
    const chartSurgicalHistoryUrl = `/chart/${this.stripPatientId(patientId)}/surgicalhistory`;
    const additionalInfo = {
      cxId,
      practiceId: this.practiceId,
      patientId,
      departmentId,
      procedureId: procedure.id,
    };
    const cptCode = getProcedureCptCode(procedure);
    if (!cptCode) {
      throw new BadRequestError("No CPT code found for procedure", undefined, additionalInfo);
    }
    const performedDate = getProcedurePerformedDate(procedure);
    if (!performedDate) {
      throw new BadRequestError("No performed date found for procedure", undefined, additionalInfo);
    }
    const procedures = [
      {
        note: "Added via Metriport App",
        procedurecode: cptCode,
        proceduredate: this.formatDate(performedDate),
      },
    ];
    const data = {
      departmentid: this.stripDepartmentId(departmentId),
      procedures,
      THIRDPARTYUSERNAME: undefined,
      PATIENTFACINGCALL: undefined,
    };
    const createdSurgicalHistory = await this.makeRequest<CreatedSurgicalHistory>({
      cxId,
      patientId,
      s3Path: `chart/surgicalhistory/${additionalInfo.procedureId ?? "unknown"}`,
      method: "POST",
      data,
      url: chartSurgicalHistoryUrl,
      schema: createdSurgicalHistorySchema,
      additionalInfo,
      debug,
    });
    if (
      !createdSurgicalHistory.success ||
      !createdSurgicalHistory.procedureids ||
      createdSurgicalHistory.procedureids.length < 1
    ) {
      throw new MetriportError("Surgical history creation failed", undefined, {
        ...additionalInfo,
        error: createdSurgicalHistory.errormessage,
      });
    }
    return createdSurgicalHistorySuccessSchema.parse(createdSurgicalHistory);
  }

  async createLabResultDocument({
    cxId,
    patientId,
    departmentId,
    observation,
  }: {
    cxId: string;
    patientId: string;
    departmentId: string;
    observation: Observation;
  }): Promise<CreatedLabResultSuccess> {
    const { debug } = out(
      `AthenaHealth createLabResultDocument - cxId ${cxId} practiceId ${this.practiceId} patientId ${patientId} departmentId ${departmentId}`
    );
    const chartLabResultUrl = `/patients/${this.stripPatientId(patientId)}/documents/labresult`;
    const additionalInfo = {
      cxId,
      practiceId: this.practiceId,
      patientId,
      departmentId,
      observationId: observation.id,
    };
    const loincCoding = getObservationLoincCoding(observation);
    if (!loincCoding) {
      throw new BadRequestError("No LOINC code found for observation", undefined, additionalInfo);
    }
    const unitAndValue = getObservationUnitAndValue(observation);
    if (!unitAndValue) {
      throw new BadRequestError(
        "No unit or value found for observation",
        undefined,
        additionalInfo
      );
    }
    const [unit, value] = unitAndValue;
    const referenceRange = getObservationReferenceRange(observation);
    if (!referenceRange) {
      throw new BadRequestError(
        "No reference range found for observation",
        undefined,
        additionalInfo
      );
    }
    const resultStatus = getObservationResultStatus(observation);
    if (!resultStatus || !validObservationResultStatuses.includes(resultStatus.toLowerCase())) {
      throw new BadRequestError(
        "No result status found for observation",
        undefined,
        additionalInfo
      );
    }
    const observedDate = getObservationObservedDate(observation);
    if (!observedDate) {
      throw new BadRequestError(
        "No observed date found for observation",
        undefined,
        additionalInfo
      );
    }
    const interpretation = getObservationInterpretation(observation, value);
    const analytes = [
      {
        abnormalflag: interpretation?.toUpperCase(),
        analytename: loincCoding.display,
        loinc: loincCoding.code,
        referencerange: referenceRange,
        units: unit,
        value: value.toString(),
        resultstatus: toTitleCase(resultStatus.toLowerCase()),
        note: "Added via Metriport App",
      },
    ];
    const data = {
      departmentid: this.stripDepartmentId(departmentId),
      analytes,
      observationdate: this.formatDate(observedDate),
      internalnote: loincCoding.display,
      documenttypeid: labResultDocumentId,
      autoclose: "true",
    };
    const createdLabResult = await this.makeRequest<CreatedLabResult>({
      cxId,
      patientId,
      s3Path: `chart/labresult/${additionalInfo.observationId ?? "unknown"}`,
      method: "POST",
      data,
      url: chartLabResultUrl,
      schema: createdLabResultSchema,
      additionalInfo,
      debug,
    });
    if (!createdLabResult.success || !createdLabResult.labresultid) {
      throw new MetriportError("Lab result creation failed", undefined, {
        ...additionalInfo,
        error: createdLabResult.errormessage,
      });
    }
    return createdLabResultSuccessSchema.parse(createdLabResult);
  }

  async createClinicalDocument({
    cxId,
    patientId,
    departmentId,
    encounterText,
    date,
  }: {
    cxId: string;
    patientId: string;
    departmentId: string;
    encounterText: string;
    date: string;
  }): Promise<CreatedClinicalDocumentSuccess> {
    const { debug } = out(
      `AthenaHealth createClinicalDocument - cxId ${cxId} practiceId ${this.practiceId} patientId ${patientId} departmentId ${departmentId}`
    );
    const chartEncounterUrl = `/patients/${this.stripPatientId(
      patientId
    )}/documents/clinicaldocument`;
    const additionalInfo = {
      cxId,
      practiceId: this.practiceId,
      patientId,
      departmentId,
    };
    const data = {
      departmentid: this.stripDepartmentId(departmentId),
      documentdata: encounterText,
      documentsubclass: clinicalNoteDocumentSubclass,
      documenttypeid: clinicalNoteDocumentId,
      internalnote: "Note Added via Metriport App",
      observationdate: this.formatDate(date),
      autoclose: "true",
    };
    const createdClinicalDocument = await this.makeRequest<CreatedClinicalDocument>({
      cxId,
      patientId,
      s3Path: `chart/clinicaldocument`,
      method: "POST",
      data,
      url: chartEncounterUrl,
      schema: createdClinicalDocumentSchema,
      additionalInfo,
      debug,
    });
    if (!createdClinicalDocument.success || !createdClinicalDocument.clinicaldocumentid) {
      throw new MetriportError("Clinical document creation failed", undefined, {
        ...additionalInfo,
        error: createdClinicalDocument.errormessage,
      });
    }
    return createdClinicalDocumentSuccessSchema.parse(createdClinicalDocument);
  }

  async createAllergy({
    cxId,
    patientId,
    departmentId,
    allergyIntolerance,
  }: {
    cxId: string;
    patientId: string;
    departmentId: string;
    allergyIntolerance: AllergyIntolerance;
  }): Promise<CreatedAllergySuccess> {
    const { debug } = out(
      `AthenaHealth createAllergy - cxId ${cxId} practiceId ${this.practiceId} patientId ${patientId} departmentId ${departmentId}`
    );
    const chartAllergyUrl = `/chart/${this.stripPatientId(patientId)}/allergies`;
    const additionalInfo = {
      cxId,
      practiceId: this.practiceId,
      patientId,
      departmentId,
      allergyIntoleranceId: allergyIntolerance.id,
    };
    const reaction = allergyIntolerance.reaction;
    if (!reaction || reaction.length < 1) {
      throw new BadRequestError("No reactions found for allergy", undefined, additionalInfo);
    }
    const codingsWithSeverityPairs: [Coding, Coding, string | undefined][] = reaction.flatMap(r => {
      const substanceRxnormCoding = getAllergyIntoleranceSubstanceRxnormCoding(r);
      if (!substanceRxnormCoding) return [];
      const manifestationSnomedCoding = getAllergyIntoleranceManifestationSnomedCoding(r);
      if (!manifestationSnomedCoding) return [];
      return [[substanceRxnormCoding, manifestationSnomedCoding, r.severity]];
    });
    const codingsWithSeverityPair = codingsWithSeverityPairs[0];
    if (!codingsWithSeverityPair) {
      throw new BadRequestError(
        "No RXNORM and SNOMED codes found for allergy reaction",
        undefined,
        additionalInfo
      );
    }
    const [substanceRxnormCoding, manifestationSnomedCoding, severity] = codingsWithSeverityPair;
    const allergenReference = await this.searchForAllergen({
      cxId,
      patientId,
      coding: substanceRxnormCoding,
    });
    if (!allergenReference) {
      throw new BadRequestError("No allergen option found via search", undefined, additionalInfo);
    }
    const existingAllergy = await this.getAllergyForPatient({
      cxId,
      patientId,
      departmentId,
      allergenId: allergenReference.allergenid,
    });
    const existingReactions = existingAllergy?.reactions ?? [];
    const possibleReactions = await this.getCompleteAllergyReactions({ cxId });
    const reactionReference = possibleReactions.find(
      r => r.snomedcode === manifestationSnomedCoding.code
    );
    if (!reactionReference) {
      throw new BadRequestError(
        "No reaction reference found for allergy reaction manifestation",
        undefined,
        additionalInfo
      );
    }
    const possibleSeverities = await this.getCompleteAllergySeverities({ cxId });
    const severityReference = severity
      ? possibleSeverities.find(s => s.severity.toLowerCase() === severity.toLowerCase())
      : undefined;
    const newReaction = {
      reactionname: reactionReference.reactionname,
      snomedcode: reactionReference.snomedcode,
      ...(severityReference
        ? {
            severity: severityReference.severity,
            severitysnomedcode: severityReference.snomedcode,
          }
        : {}),
    };
    const allReactions = uniqBy([...existingReactions, newReaction], "snomedcode");
    const onsetDate = getAllergyIntoleranceOnsetDate(allergyIntolerance);
    if (!onsetDate) {
      throw new BadRequestError("No onset date found for allergy", undefined, additionalInfo);
    }
    const criticality = allergyIntolerance.criticality;
    const allergies = [
      {
        allergenid: allergenReference.allergenid,
        allergenname: allergenReference.allergenname,
        ...(existingAllergy
          ? {
              criticality: existingAllergy.criticality,
              onsetdate: existingAllergy.onsetdate,
            }
          : { criticality, onsetdate: this.formatDate(onsetDate) }),
        note: "Added via Metriport App",
        reactions: allReactions,
      },
    ];
    const data = {
      departmentid: this.stripDepartmentId(departmentId),
      allergies,
      THIRDPARTYUSERNAME: undefined,
      PATIENTFACINGCALL: undefined,
    };
    const createdAllergy = await this.makeRequest<CreatedAllergy>({
      cxId,
      patientId,
      s3Path: `chart/allergy/${additionalInfo.allergyIntoleranceId ?? "unknown"}`,
      method: "PUT",
      data,
      url: chartAllergyUrl,
      schema: createdAllergySchema,
      additionalInfo,
      debug,
    });
    if (!createdAllergy.success) {
      throw new MetriportError("Allergy creation failed", undefined, {
        ...additionalInfo,
        error: createdAllergy.errormessage,
      });
    }
    return createdAllergySuccessSchema.parse(createdAllergy);
  }

  async createVitals({
    cxId,
    patientId,
    departmentId,
    vitals,
  }: {
    cxId: string;
    patientId: string;
    departmentId: string;
    vitals: GroupedVitals;
  }): Promise<CreatedVitalsSuccess[]> {
    const { log, debug } = out(
      `AthenaHealth createVitals - cxId ${cxId} practiceId ${this.practiceId} patientId ${patientId} departmentId ${departmentId}`
    );
    const chartVitalsUrl = `/chart/${this.stripPatientId(patientId)}/vitals`;
    const observation = vitals.mostRecentObservation;
    const additionalInfo = {
      cxId,
      practiceId: this.practiceId,
      patientId,
      departmentId,
      observationId: observation.id,
    };
    if (!vitals.sortedPoints || vitals.sortedPoints.length < 1) {
      throw new BadRequestError("No points found for vitals", undefined, additionalInfo);
    }
    if (uniqBy(vitals.sortedPoints, "date").length !== vitals.sortedPoints.length) {
      throw new BadRequestError("Duplicate reading taken for vitals", undefined, {
        ...additionalInfo,
        dates: vitals.sortedPoints.map(v => v.date).join(", "),
      });
    }
    const loincCode = getObservationLoincCode(observation);
    if (!loincCode) {
      throw new BadRequestError("No code found for observation", undefined, additionalInfo);
    }
    const clinicalElementId = vitalSignCodesMapAthena.get(loincCode);
    if (!clinicalElementId) {
      throw new BadRequestError("No clinical element id found for observation", undefined, {
        ...additionalInfo,
        loincCode,
      });
    }
    const units = getObservationUnits(observation);
    if (!units) {
      throw new BadRequestError("No units found for observation", undefined, {
        ...additionalInfo,
        loincCode,
        clinicalElementId,
      });
    }
    const allCreatedVitals: CreatedVitalsSuccess[] = [];
    const createVitalsErrors: { error: unknown; vitals: string }[] = [];
    const createVitalsArgs: VitalsCreateParams[] = vitals.sortedPoints.map(v => {
      const vitalsData = this.createVitalsData(v, clinicalElementId, units);
      return {
        departmentid: this.stripDepartmentId(departmentId),
        returnvitalids: true,
        source: "DEVICEGENERATED",
        vitals: [vitalsData],
        THIRDPARTYUSERNAME: undefined,
        PATIENTFACINGCALL: undefined,
      };
    });
    await executeAsynchronously(
      createVitalsArgs,
      async (params: VitalsCreateParams) => {
        try {
          const createdVitals = await this.makeRequest<CreatedVitals>({
            cxId,
            patientId,
            s3Path: `chart/vitals/${additionalInfo.observationId ?? "unknown"}`,
            method: "POST",
            data: params,
            url: chartVitalsUrl,
            schema: createdVitalsSchema,
            additionalInfo,
            debug,
          });
          if (
            !createdVitals.success ||
            !createdVitals.vitalids ||
            createdVitals.vitalids.length < 1
          ) {
            throw new MetriportError("Vitals creation failed", undefined, {
              ...additionalInfo,
              error: createdVitals.errormessage,
            });
          }
          allCreatedVitals.push(createdVitalsSuccessSchema.parse(createdVitals));
        } catch (error) {
          if (error instanceof BadRequestError || error instanceof NotFoundError) return;
          const vitalsToString = JSON.stringify(params.vitals);
          log(`Failed to create vitals ${vitalsToString}. Cause: ${errorToString(error)}`);
          createVitalsErrors.push({ error, ...params, vitals: vitalsToString });
        }
      },
      {
        numberOfParallelExecutions: parallelRequests,
        delay: delayBetweenRequestBatches.asMilliseconds(),
      }
    );
    if (createVitalsErrors.length > 0) {
      const msg = `Failure while creating some vitals @ AthenaHealth`;
      capture.message(msg, {
        extra: {
          ...additionalInfo,
          createVitalsArgsCount: createVitalsArgs.length,
          createVitalsErrorsCount: createVitalsErrors.length,
          errors: createVitalsErrors,
          context: "athenahealth.create-vitals",
        },
        level: "warning",
      });
    }
    return allCreatedVitals;
  }

  async searchForMedication({
    cxId,
    patientId,
    coding,
  }: {
    cxId: string;
    patientId: string;
    coding: Coding;
  }): Promise<MedicationReference | undefined> {
    const { log, debug } = out(
      `AthenaHealth searchForMedication - cxId ${cxId} practiceId ${this.practiceId} patientId ${patientId}`
    );
    const referenceUrl = "/reference/medications";
    const additionalInfo = {
      cxId,
      practiceId: this.practiceId,
      patientId,
      code: coding.code,
      system: coding.system,
      display: coding.display,
    };
    const codingDisplay = coding.display;
    if (!codingDisplay) {
      throw new BadRequestError("No display found for coding", undefined, additionalInfo);
    }
    const searchValues = this.getSearchvaluesFromCoding(codingDisplay, additionalInfo);
    const allMedicationReferences: MedicationReference[] = [];
    const searchMedicationErrors: { error: unknown; searchValue: string }[] = [];
    const searchMedicationArgs: string[] = searchValues;
    await executeAsynchronously(
      searchMedicationArgs,
      async (searchValue: string) => {
        try {
          const medicationReferences = await this.makeRequest<MedicationReferences>({
            cxId,
            patientId,
            s3Path: `reference/medications/${searchValue}`,
            method: "GET",
            url: `${referenceUrl}?searchvalue=${searchValue}`,
            schema: medicationReferencesSchema,
            additionalInfo,
            debug,
          });
          allMedicationReferences.push(...medicationReferences);
        } catch (error) {
          if (error instanceof BadRequestError || error instanceof NotFoundError) return;
          log(
            `Failed to search for medication with search value ${searchValue}. Cause: ${errorToString(
              error
            )}`
          );
          searchMedicationErrors.push({ error, searchValue });
        }
      },
      {
        numberOfParallelExecutions: parallelRequests,
        delay: delayBetweenRequestBatches.asMilliseconds(),
      }
    );
    if (searchMedicationErrors.length > 0) {
      const msg = `Failure while searching for some medications @ AthenaHealth`;
      capture.message(msg, {
        extra: {
          ...additionalInfo,
          searchMedicationArgsCount: searchMedicationArgs.length,
          searchMedicationErrorsCount: searchMedicationErrors.length,
          errors: searchMedicationErrors,
          context: "athenahealth.search-for-medication",
        },
        level: "warning",
      });
    }
    if (allMedicationReferences.length < 1) return undefined;
    if (allMedicationReferences.length === 1) return allMedicationReferences[0];
    const mostSimilarMedication = this.calculateJaroWinklerSimilarity(
      codingDisplay,
      allMedicationReferences.map(m => m.medication)
    );
    if (!mostSimilarMedication) return undefined;
    return allMedicationReferences.find(m => m.medication === mostSimilarMedication);
  }

  async searchForAllergen({
    cxId,
    patientId,
    coding,
  }: {
    cxId: string;
    patientId: string;
    coding: Coding;
  }): Promise<AllergenReference | undefined> {
    const { log, debug } = out(
      `AthenaHealth searchForAllergen - cxId ${cxId} practiceId ${this.practiceId} patientId ${patientId}`
    );
    const referenceUrl = "/reference/allergies";
    const additionalInfo = {
      cxId,
      practiceId: this.practiceId,
      patientId,
      code: coding.code,
      system: coding.system,
      display: coding.display,
    };
    const codingDisplay = coding.display;
    if (!codingDisplay) {
      throw new BadRequestError("No display found for coding", undefined, additionalInfo);
    }
    const searchValues = this.getSearchvaluesFromCoding(codingDisplay, additionalInfo);
    const allAllergenReferences: AllergenReference[] = [];
    const searchAllergenErrors: { error: unknown; searchValue: string }[] = [];
    const searchAllergenArgs: string[] = searchValues;
    await executeAsynchronously(
      searchAllergenArgs,
      async (searchValue: string) => {
        try {
          const allergenReferences = await this.makeRequest<AllergenReferences>({
            cxId,
            patientId,
            s3Path: `reference/allergies/${searchValue}`,
            method: "GET",
            url: `${referenceUrl}?searchvalue=${searchValue}`,
            schema: allergenReferencesSchema,
            additionalInfo,
            debug,
          });
          allAllergenReferences.push(...allergenReferences);
        } catch (error) {
          if (error instanceof BadRequestError || error instanceof NotFoundError) return;
          log(
            `Failed to search for allergen with search value ${searchValue}. Cause: ${errorToString(
              error
            )}`
          );
          searchAllergenErrors.push({ error, searchValue });
        }
      },
      {
        numberOfParallelExecutions: parallelRequests,
        delay: delayBetweenRequestBatches.asMilliseconds(),
      }
    );
    if (searchAllergenErrors.length > 0) {
      const msg = `Failure while searching for some allergens @ AthenaHealth`;
      capture.message(msg, {
        extra: {
          ...additionalInfo,
          searchAllergenArgsCount: searchAllergenArgs.length,
          searchAllergenErrorsCount: searchAllergenErrors.length,
          errors: searchAllergenErrors,
          context: "athenahealth.search-for-allergen",
        },
        level: "warning",
      });
    }
    if (allAllergenReferences.length < 1) return undefined;
    if (allAllergenReferences.length === 1) return allAllergenReferences[0];
    const mostSimilarAllergen = this.calculateJaroWinklerSimilarity(
      codingDisplay,
      allAllergenReferences.map(a => a.allergenname)
    );
    if (!mostSimilarAllergen) return undefined;
    return allAllergenReferences.find(a => a.allergenname === mostSimilarAllergen);
  }

  async getCompleteAllergyReactions({
    cxId,
  }: {
    cxId: string;
  }): Promise<AllergyReactionReference[]> {
    const { debug } = out(
      `AthenaHealth searchForAllergyReactions - cxId ${cxId} practiceId ${this.practiceId}`
    );
    const referenceUrl = "/reference/allergies/reactions";
    const additionalInfo = {
      cxId,
      practiceId: this.practiceId,
    };
    const allergyReactionReferences = await this.makeRequest<AllergyReactionReferences>({
      cxId,
      s3Path: "reference/allergies/reactions",
      method: "GET",
      url: referenceUrl,
      schema: allergyReactionReferencesSchema,
      additionalInfo,
      debug,
    });
    return allergyReactionReferences;
  }

  async getCompleteAllergySeverities({
    cxId,
  }: {
    cxId: string;
  }): Promise<AllergySeverityReference[]> {
    const { debug } = out(
      `AthenaHealth getAllergySeverities - cxId ${cxId} practiceId ${this.practiceId}`
    );
    const referenceUrl = "/reference/allergies/severities";
    const additionalInfo = {
      cxId,
      practiceId: this.practiceId,
    };
    const allergySeverityReferences = await this.makeRequest<AllergySeverityReferences>({
      cxId,
      s3Path: "reference/allergies/severities",
      method: "GET",
      url: referenceUrl,
      schema: allergySeverityReferencesSchema,
      additionalInfo,
      debug,
    });
    return allergySeverityReferences;
  }

  async subscribeToEvent({
    cxId,
    feedtype,
    eventType,
  }: {
    cxId: string;
    feedtype: FeedType;
    eventType?: EventType;
  }): Promise<CreatedSubscriptionSuccess> {
    const { debug } = out(
      `AthenaHealth subscribeToEvent - cxId ${cxId} practiceId ${this.practiceId} feedtype ${feedtype}`
    );
    const subscribeUrl = `/${feedtype}/changed/subscription`;
    const additionalInfo = {
      cxId,
      practiceId: this.practiceId,
      feedtype,
      eventType,
    };
    const createdSubscription = await this.makeRequest<CreatedSubscription>({
      cxId,
      s3Path: "subscribe",
      method: "POST",
      data: eventType ? { eventname: eventType } : {},
      url: subscribeUrl,
      schema: createdSubscriptionSchema,
      additionalInfo,
      debug,
    });
    if (!createdSubscription.success) {
      throw new MetriportError(`Subscription failed`, undefined, additionalInfo);
    }
    return createdSubscriptionSuccessSchema.parse(createdSubscription);
  }

  async getAppointments({
    cxId,
    departmentIds,
    startAppointmentDate,
    endAppointmentDate,
  }: {
    cxId: string;
    departmentIds?: string[];
    startAppointmentDate: Date;
    endAppointmentDate: Date;
  }): Promise<BookedAppointment[]> {
    const { debug } = out(
      `AthenaHealth getAppointments - cxId ${cxId} practiceId ${this.practiceId} departmentIds ${departmentIds}`
    );
    const params = {
      startdate: this.formatDate(startAppointmentDate.toISOString()) ?? "",
      enddate: this.formatDate(endAppointmentDate.toISOString()) ?? "",
      limit: "1000",
    };
    const urlParams = new URLSearchParams(params);
    if (departmentIds && departmentIds.length > 0) {
      departmentIds.map(dpId => urlParams.append("departmentid", this.stripDepartmentId(dpId)));
    } else {
      const allDepartmentIds = await this.getDepartmentIds(cxId);
      allDepartmentIds.map(dpId => urlParams.append("departmentid", this.stripDepartmentId(dpId)));
    }
    const appointmentUrl = `/appointments/booked/multipledepartment?${urlParams.toString()}`;
    const additionalInfo = {
      cxId,
      practiceId: this.practiceId,
      departmentIds: departmentIds?.join(","),
      startAppointmentDate: startAppointmentDate.toISOString(),
      endAppointmentDate: endAppointmentDate.toISOString(),
    };
    const bookedAppointments = await this.paginateListResponse<BookedAppointment>(
      this,
      async url => {
        const bookedAppointmentListResponse = await this.makeRequest<BookedAppointmentListResponse>(
          {
            cxId,
            s3Path: "appointments",
            method: "GET",
            url,
            schema: bookedAppointmentListResponseSchema,
            additionalInfo,
            debug,
          }
        );
        return {
          listOfItems: bookedAppointmentListResponse.appointments,
          nextUrl: bookedAppointmentListResponse.next,
        };
      },
      appointmentUrl
    );
    return bookedAppointments;
  }

  async getAppointmentsFromSubscription({
    cxId,
    departmentIds,
    startProcessedDate,
    endProcessedDate,
  }: {
    cxId: string;
    departmentIds?: string[];
    startProcessedDate?: Date;
    endProcessedDate?: Date;
  }): Promise<BookedAppointment[]> {
    const { log, debug } = out(
      `AthenaHealth getAppointmentsFromSubscription - cxId ${cxId} practiceId ${this.practiceId} departmentIds ${departmentIds}`
    );
    const params = {
      ...(startProcessedDate && {
        showprocessedstartdatetime: this.formatDateTime(startProcessedDate.toISOString()) ?? "",
      }),
      ...(endProcessedDate && {
        showprocessedenddatetime: this.formatDateTime(endProcessedDate.toISOString()) ?? "",
      }),
      limit: "1000",
    };
    const urlParams = new URLSearchParams(params);
    if (departmentIds && departmentIds.length > 0) {
      departmentIds.map(dpId => urlParams.append("departmentid", this.stripDepartmentId(dpId)));
    }
    const appointmentUrl = `/appointments/changed?${urlParams.toString()}`;
    const additionalInfo = {
      cxId,
      practiceId: this.practiceId,
      departmentIds: departmentIds?.join(","),
      startProcessedDate: startProcessedDate?.toISOString(),
      endProcessedDate: endProcessedDate?.toISOString(),
    };
    try {
      const appointmentEvents = await this.paginateListResponse<AppointmentEvent>(
        this,
        async url => {
          const appointmentEventListResponse = await this.makeRequest<AppointmentEventListResponse>(
            {
              cxId,
              s3Path: "appointments-changed",
              method: "GET",
              url,
              schema: appointmentEventListResponseSchema,
              additionalInfo,
              debug,
            }
          );
          return {
            listOfItems: appointmentEventListResponse.appointments,
            nextUrl: appointmentEventListResponse.next,
          };
        },
        appointmentUrl
      );
      const bookedAppointments = appointmentEvents
        .filter(app => app.patientid !== undefined && app.appointmentstatus === "f")
        .map(a => bookedAppointmentSchema.parse(a));
      return bookedAppointments;
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } catch (error: any) {
      if (
        error.message?.includes(
          "Changed messages require setup (subscription) that has not been done."
        )
      ) {
        // 403 indicates no existing subscription so we create one
        log(`Subscribing to appointment event for cxId ${cxId}`);
        await this.subscribeToEvent({
          cxId,
          feedtype: "appointments",
          eventType: "ScheduleAppointment",
        });
        return [];
      }
      throw error;
    }
  }

  private async makeRequest<T>({
    cxId,
    patientId,
    s3Path,
    url,
    method,
    data,
    schema,
    additionalInfo,
    debug,
    useFhir = false,
  }: MakeRequestParamsInEhr<T> & { useFhir?: boolean }): Promise<T> {
    const axiosInstance = useFhir ? this.axiosInstanceFhir : this.axiosInstanceProprietary;
    return await makeRequest<T>({
      ehr: EhrSources.athena,
      cxId,
      practiceId: this.practiceId,
      patientId,
      s3Path,
      axiosInstance,
      url,
      method,
      data,
      schema,
      additionalInfo,
      debug,
    });
  }

  private async paginateListResponse<T>(
    api: AthenaHealthApi,
    requester: (url: string) => Promise<{ listOfItems: T[]; nextUrl: string | undefined }>,
    url: string | undefined,
    acc: T[] | undefined = []
  ): Promise<T[]> {
    if (!url) return acc;
    await sleep(paginateWaitTime.asMilliseconds());
    const { listOfItems, nextUrl } = await requester(url.replace(`/v1/${this.practiceId}`, ""));
    acc.push(...listOfItems);
    if (!nextUrl) return acc;
    return api.paginateListResponse(api, requester, nextUrl, acc);
  }

  private formatDate(date: string | undefined): string | undefined {
    return formatDate(date, athenaDateFormat);
  }

  private formatDateTime(date: string | undefined): string | undefined {
    return formatDate(date, athenaDateTimeFormat);
  }

  stripPracticeId(id: string) {
    return id.replace(`a-1.${athenaPracticePrefix}-`, "");
  }

  createPracticetId(id: string) {
    const prefix = `a-1.${athenaPracticePrefix}-`;
    if (id.startsWith(prefix)) return id;
    return `${prefix}${id}`;
  }

  stripPatientId(id: string) {
    return id.replace(`a-${this.practiceId}.${athenaPatientPrefix}-`, "");
  }

  createPatientId(id: string) {
    const prefix = `a-${this.practiceId}.${athenaPatientPrefix}-`;
    if (id.startsWith(prefix)) return id;
    return `${prefix}${id}`;
  }

  stripDepartmentId(id: string) {
    return id.replace(`a-${this.practiceId}.${athenaDepartmentPrefix}-`, "");
  }

  createDepartmentId(id: string) {
    const prefix = `a-${this.practiceId}.${athenaDepartmentPrefix}-`;
    if (id.startsWith(prefix)) return id;
    return `${prefix}${id}`;
  }

  private createVitalsData(
    dataPoint: DataPoint,
    clinicalElementId: string,
    units: string
  ): { [key: string]: string | undefined }[] {
    if (dataPoint.bp) {
      return [
        {
          clinicalelementid: "VITALS.BLOODPRESSURE.DIASTOLIC",
          readingtaken: this.formatDate(dataPoint.date),
          value: dataPoint.bp.diastolic.toString(),
        },
        {
          clinicalelementid: "VITALS.BLOODPRESSURE.SYSTOLIC",
          readingtaken: this.formatDate(dataPoint.date),
          value: dataPoint.bp.systolic.toString(),
        },
      ];
    }
    return [
      {
        clinicalelementid: clinicalElementId,
        readingtaken: this.formatDate(dataPoint.date),
        value: this.convertValue(clinicalElementId, dataPoint.value, units).toString(),
      },
    ];
  }

  private convertValue(clinicalElementId: string, value: number, units: string): number {
    if (!clinicalElementsThatRequireUnits.includes(clinicalElementId)) return value;
    if (units === "g" || units === "gram" || units === "grams") return value; // https://hl7.org/fhir/R4/valueset-ucum-bodyweight.html
    if (units === "cm" || units.includes("centimeter")) return value; // https://hl7.org/fhir/R4/valueset-ucum-bodylength.html
    if (units === "degf" || units === "f" || units.includes("fahrenheit")) return value; // https://hl7.org/fhir/R4/valueset-ucum-bodytemp.html
    if (units === "lb_av" || units.includes("pound")) return this.convertLbsToGrams(value); // https://hl7.org/fhir/R4/valueset-ucum-bodyweight.html
    if (units === "kg" || units === "kilogram" || units === "kilograms") {
      return this.convertKiloGramsToGrams(value); // https://hl7.org/fhir/R4/valueset-ucum-bodyweight.html
    }
    if (units === "in_i" || units.includes("inch")) return this.convertInchesToCm(value); // https://hl7.org/fhir/R4/valueset-ucum-bodylength.html
    if (units === "cel" || units === "c" || units.includes("celsius")) {
      return this.convertCelciusToFahrenheit(value); // https://hl7.org/fhir/R4/valueset-ucum-bodytemp.html
    }
    throw new BadRequestError("Unknown units", undefined, {
      units,
      clinicalElementId,
      value,
    });
  }

  private convertLbsToGrams(value: number): number {
    return value * lbsToG;
  }

  private convertKiloGramsToGrams(value: number): number {
    return value * kgToG;
  }

  private convertInchesToCm(value: number): number {
    return value * inchesToCm;
  }

  private convertCelciusToFahrenheit(value: number): number {
    return value * (9 / 5) + 32;
  }

  private getSearchvaluesFromCoding(
    codingDisplay: string,
    additionalInfo: Record<string, string | undefined>
  ): string[] {
    const searchValues = codingDisplay
      .split("/")
      .flatMap(v => v.split(" "))
      .map(v => v.toLowerCase())
      .map(v => {
        if (v.endsWith("s")) return v.slice(0, -1);
        return v;
      });
    const searchValuesWithAtLeastTwoParts = searchValues.filter(
      searchValue => searchValue.length >= 2
    );
    if (searchValuesWithAtLeastTwoParts.length < 1) {
      throw new BadRequestError(
        "No search values with at least two parts",
        undefined,
        additionalInfo
      );
    }
    return searchValuesWithAtLeastTwoParts;
  }

  private calculateJaroWinklerSimilarity(target: string, options: string[]): string | undefined {
    let mostSimilarOption = options[0];
    if (!mostSimilarOption) return undefined;
    let maxSimilarity = jaroWinkler(target, mostSimilarOption);
    for (const option of options) {
      const similarity = jaroWinkler(target, option);
      if (similarity > maxSimilarity) {
        maxSimilarity = similarity;
        mostSimilarOption = option;
      }
    }
    if (maxSimilarity < minAllowedSimilarity) {
      throw new BadRequestError("No similar enough option found", undefined, {
        target,
        maxSimilarity,
      });
    }
    return mostSimilarOption;
  }
}

export default AthenaHealthApi;

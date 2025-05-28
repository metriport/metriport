import {
  AllergyIntolerance,
  Condition,
  Immunization,
  Medication,
  MedicationAdministration,
  MedicationDispense,
  MedicationStatement,
  Observation,
  Procedure,
} from "@medplum/fhirtypes";
import {
  BadRequestError,
  errorToString,
  JwtTokenInfo,
  MetriportError,
  NotFoundError,
} from "@metriport/shared";
import { buildDayjs } from "@metriport/shared/common/date";
import {
  AllergenReference,
  AllergenReferences,
  allergenReferencesSchema,
  Allergies,
  allergiesSchema,
  Allergy,
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
  CreatedEncounter,
  createdEncounterSchema,
  CreatedEncounterSuccess,
  createdEncounterSuccessSchema,
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
  CreatedVaccine,
  createdVaccineSchema,
  CreatedVaccineSuccess,
  createdVaccineSuccessSchema,
  CreatedVitals,
  createdVitalsSchema,
  CreatedVitalsSuccess,
  createdVitalsSuccessSchema,
  Departments,
  departmentsSchema,
  EventType,
  FeedType,
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
import { getObservationCode, getObservationUnits } from "@metriport/shared/medical";
import axios, { AxiosInstance } from "axios";
import dayjs from "dayjs";
import { uniqBy } from "lodash";
import { executeAsynchronously } from "../../../util/concurrency";
import { out } from "../../../util/log";
import { capture } from "../../../util/notifications";
import {
  ApiConfig,
  createDataParams,
  formatDate,
  getAllergyIntoleranceOnsetDate,
  getAllergyIntoleranceReactionSnomedCoding,
  getConditionSnomedCode,
  getConditionStartDate,
  getConditionStatus,
  getImmunizationAdministerDate,
  getImmunizationCvxCode,
  getObservationLoincCoding,
  getObservationObservedDate,
  getObservationReferenceRange,
  getObservationResultStatus,
  getObservationUnitAndValue,
  getProcedureLoincCode,
  getProcedurePerformedDate,
  makeRequest,
  MakeRequestParamsInEhr,
} from "../shared";

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

const lbsToG = 453.592;
const kgToG = 1000;
const inchesToCm = 2.54;

// TYPES FROM DASHBOARD
export type MedicationWithRefs = {
  medication: Medication;
  administration?: MedicationAdministration;
  dispense?: MedicationDispense;
  statement?: MedicationStatement;
};

export type GroupedVitals = {
  mostRecentObservation: Observation;
  sortedPoints?: DataPoint[];
};

type BloodPressure = {
  systolic: number;
  diastolic: number;
};

type DataPoint = {
  value: number;
  date: string;
  unit?: string;
  bp?: BloodPressure | undefined;
};

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

  async getPatientAllergy({
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
      `AthenaHealth getAllergies - cxId ${cxId} practiceId ${this.practiceId} patientId ${patientId}`
    );
    const params = {
      departmentid: this.stripDepartmentId(departmentId),
    };
    const queryParams = new URLSearchParams(params);
    const allergiesUrl = `/patients/${this.stripPatientId(
      patientId
    )}/allergies?${queryParams.toString()}`;
    const additionalInfo = { cxId, practiceId: this.practiceId, patientId };
    const allergies = await this.makeRequest<Allergies>({
      cxId,
      patientId,
      s3Path: "allergies",
      method: "GET",
      url: allergiesUrl,
      schema: allergiesSchema,
      additionalInfo,
      debug,
    });
    const allergy = allergies.allergies.find(a => a.allergenid === allergenId);
    return allergy;
  }

  async getCustomFieldsForPatient({
    cxId,
    patientId,
    departmentId,
  }: {
    cxId: string;
    patientId: string;
    departmentId?: string;
  }): Promise<PatientCustomField[]> {
    const { debug } = out(
      `AthenaHealth getCustomFieldsForPatient - cxId ${cxId} practiceId ${this.practiceId} patientId ${patientId}`
    );
    const params = {
      showprivacycustomfields: "true",
      showcustomfields: "true",
      ...(departmentId ? { departmentid: this.stripDepartmentId(departmentId) } : {}),
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

  async createMedication({
    cxId,
    patientId,
    departmentId,
    medication,
  }: {
    cxId: string;
    patientId: string;
    departmentId: string;
    medication: MedicationWithRefs;
  }): Promise<CreatedMedicationSuccess> {
    const { debug } = out(
      `AthenaHealth createMedication - cxId ${cxId} practiceId ${this.practiceId} patientId ${patientId} departmentId ${departmentId}`
    );
    const chartMedicationUrl = `/chart/${this.stripPatientId(patientId)}/medications`;
    const additionalInfo = {
      cxId,
      practiceId: this.practiceId,
      patientId,
      departmentId,
      medicationId: medication.medication.id,
    };
    const medicationOptions = await this.searchForMedication({
      cxId,
      patientId,
      medication: medication.medication,
    });
    const firstOption = medicationOptions[0];
    if (!firstOption) {
      throw new BadRequestError(
        "No medication options found via search",
        undefined,
        additionalInfo
      );
    }
    const data = {
      departmentid: this.stripDepartmentId(departmentId),
      providernote: "Added via Metriport App",
      unstructuredsig: "Metriport",
      medicationid: `${firstOption.medicationid}`,
      hidden: false,
      startdate: this.formatDate(medication.statement?.effectivePeriod?.start),
      stopdate: this.formatDate(medication.statement?.effectivePeriod?.end),
      stopreason: undefined,
      patientnote: undefined,
      THIRDPARTYUSERNAME: undefined,
      PATIENTFACINGCALL: undefined,
    };
    const createdMedication = await this.makeRequest<CreatedMedication>({
      cxId,
      patientId,
      s3Path: `chart/medication/${additionalInfo.medicationId ?? "unknown"}`,
      method: "POST",
      data,
      url: chartMedicationUrl,
      schema: createdMedicationSchema,
      additionalInfo,
      debug,
    });
    if (!createdMedication.success) {
      throw new MetriportError("Medication creation failed", undefined, {
        ...additionalInfo,
        error: createdMedication.errormessage,
      });
    }
    return createdMedicationSuccessSchema.parse(createdMedication);
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
    if (!createdProblem.success) {
      throw new MetriportError("Problem creation failed", undefined, {
        ...additionalInfo,
        error: createdProblem.errormessage,
      });
    }
    return createdProblemSuccessSchema.parse(createdProblem);
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
  }): Promise<CreatedVaccineSuccess> {
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
      administereddate: this.formatDate(administeredDate),
      THIRDPARTYUSERNAME: undefined,
      PATIENTFACINGCALL: undefined,
    };
    const createdVaccine = await this.makeRequest<CreatedVaccine>({
      cxId,
      patientId,
      s3Path: `chart/vaccine/${additionalInfo.immunizationId ?? "unknown"}`,
      method: "POST",
      data,
      url: chartVaccineUrl,
      schema: createdVaccineSchema,
      additionalInfo,
      debug,
    });
    if (!createdVaccine.success) {
      throw new MetriportError("Vaccine creation failed", undefined, {
        ...additionalInfo,
        error: createdVaccine.errormessage,
      });
    }
    return createdVaccineSuccessSchema.parse(createdVaccine);
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
    const loincCode = getProcedureLoincCode(procedure);
    if (!loincCode) {
      throw new BadRequestError("No LOINC code found for procedure", undefined, additionalInfo);
    }
    const performedDate = getProcedurePerformedDate(procedure);
    if (!performedDate) {
      throw new BadRequestError("No performed date found for procedure", undefined, additionalInfo);
    }
    const procedures = [
      {
        note: "Added via Metriport App",
        delete: true,
        procedurecode: loincCode,
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
    if (!createdSurgicalHistory.success) {
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
      `AthenaHealth createLabResult - cxId ${cxId} practiceId ${this.practiceId} patientId ${patientId} departmentId ${departmentId}`
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
    if (!resultStatus) {
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
    const analytes = [
      {
        analytename: loincCoding.display,
        loinc: loincCoding.code,
        referencerange: referenceRange,
        units: unit,
        value,
        resultstatus: resultStatus,
        note: "Added via Metriport App",
      },
    ];
    const data = {
      departmentid: this.stripDepartmentId(departmentId),
      analytes,
      observationdate: this.formatDate(observedDate),
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
    if (!createdLabResult.success) {
      throw new MetriportError("Lab result creation failed", undefined, {
        ...additionalInfo,
        error: createdLabResult.errormessage,
      });
    }
    return createdLabResultSuccessSchema.parse(createdLabResult);
  }

  async createEncounterDocument({
    cxId,
    patientId,
    departmentId,
    encounterText,
  }: {
    cxId: string;
    patientId: string;
    departmentId: string;
    encounterText: string;
  }): Promise<CreatedEncounterSuccess> {
    const { debug } = out(
      `AthenaHealth createEncounter - cxId ${cxId} practiceId ${this.practiceId} patientId ${patientId} departmentId ${departmentId}`
    );
    const chartEncounterUrl = `/patients/${this.stripPatientId(
      patientId
    )}/documents/encounterdocument`;
    const additionalInfo = {
      cxId,
      practiceId: this.practiceId,
      patientId,
      departmentId,
    };
    const data = {
      departmentid: this.stripDepartmentId(departmentId),
      textdata: encounterText,
      documentsubclass: "PROGRESSNOTE",
    };
    const createdEncounter = await this.makeRequest<CreatedEncounter>({
      cxId,
      patientId,
      s3Path: `chart/encounterdocument`,
      method: "POST",
      data,
      url: chartEncounterUrl,
      schema: createdEncounterSchema,
      additionalInfo,
      debug,
    });
    if (!createdEncounter.success) {
      throw new MetriportError("Encounter document creation failed", undefined, {
        ...additionalInfo,
        error: createdEncounter.errormessage,
      });
    }
    return createdEncounterSuccessSchema.parse(createdEncounter);
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
    const allergenOptions = await this.searchForAllergen({
      cxId,
      patientId,
      allergyIntolerance: allergyIntolerance,
    });
    const firstOption = allergenOptions[0];
    if (!firstOption) {
      throw new BadRequestError("No allergen options found via search", undefined, additionalInfo);
    }
    const existingAllergy = await this.getPatientAllergy({
      cxId,
      patientId,
      departmentId,
      allergenId: firstOption.allergenid,
    });
    const existingReactions = existingAllergy?.reactions ?? [];
    const newReactions = allergyIntolerance.reaction ?? [];
    if (existingReactions.length < 1 && newReactions.length < 1) {
      throw new BadRequestError("No reactions found for allergy", undefined, additionalInfo);
    }
    const possibleReactions = await this.getCompleteAllergyReactions({ cxId });
    const possibleSeverities = await this.getCompleteAllergySeverities({ cxId });
    const reactions = [
      ...existingReactions,
      ...newReactions.flatMap(reaction => {
        const snomedCoding = getAllergyIntoleranceReactionSnomedCoding(reaction);
        if (!snomedCoding) return [];
        const reactionReference = possibleReactions.find(r => r.snomedcode === snomedCoding.code);
        if (!reactionReference) return [];
        const severity = reaction.severity;
        if (!severity) return [];
        const severityReference = possibleSeverities.find(s => s.severity === severity);
        if (!severityReference) return [];
        return {
          reactionname: reactionReference.reactionname,
          snomedcode: reactionReference.snomedcode,
          severity: severityReference.severity,
          severitysnomedcode: severityReference.snomedcode,
        };
      }),
    ];
    const criticality = allergyIntolerance.criticality;
    const onsetDate = getAllergyIntoleranceOnsetDate(allergyIntolerance);
    if (!onsetDate) {
      throw new BadRequestError("No onset date found for allergy", undefined, additionalInfo);
    }
    const allergies = [
      {
        allergenid: firstOption.allergenid,
        allergenname: firstOption.allergenname,
        criticality: criticality,
        note: "Added via Metriport App",
        onsetdate: this.formatDate(onsetDate),
        reactions: [uniqBy(reactions, "snomedcode")],
      },
    ];
    const data = {
      departmentid: this.stripDepartmentId(departmentId),
      allergies: allergies,
      THIRDPARTYUSERNAME: undefined,
      PATIENTFACINGCALL: undefined,
    };
    const createdAllergy = await this.makeRequest<CreatedAllergy>({
      cxId,
      patientId,
      s3Path: `chart/allergy/${additionalInfo.allergyIntoleranceId ?? "unknown"}`,
      method: "POST",
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
    const code = getObservationCode(observation);
    if (!code) {
      throw new BadRequestError("No code found for observation", undefined, additionalInfo);
    }
    const clinicalElementId = vitalSignCodesMapAthena.get(code);
    if (!clinicalElementId) {
      throw new BadRequestError("No clinical element id found for observation", undefined, {
        ...additionalInfo,
        code,
      });
    }
    const units = getObservationUnits(observation);
    if (!units) {
      throw new BadRequestError("No units found for observation", undefined, {
        ...additionalInfo,
        code,
        clinicalElementId,
      });
    }
    if (!vitals.sortedPoints || vitals.sortedPoints.length === 0) {
      throw new BadRequestError("No points found for vitals", undefined, additionalInfo);
    }
    if (uniqBy(vitals.sortedPoints, "date").length !== vitals.sortedPoints.length) {
      throw new BadRequestError("Duplicate reading taken for vitals", undefined, {
        ...additionalInfo,
        dates: vitals.sortedPoints.map(v => v.date).join(", "),
      });
    }
    const allCreatedVitals: CreatedVitalsSuccess[] = [];
    const createVitalsErrors: {
      error: unknown;
      departmentid: string;
      source: string;
      vitals: string;
    }[] = [];
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
          if (!createdVitals.success) {
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
    medication,
  }: {
    cxId: string;
    patientId: string;
    medication: Medication;
  }): Promise<MedicationReference[]> {
    const { log, debug } = out(
      `AthenaHealth searchForMedication - cxId ${cxId} practiceId ${this.practiceId} patientId ${patientId}`
    );
    const referenceUrl = "/reference/medications";
    const additionalInfo = {
      cxId,
      practiceId: this.practiceId,
      patientId,
      medicationId: medication.id,
    };
    const searchValues = medication.code?.coding?.flatMap(c => c.display?.split("/") ?? []);
    if (!searchValues || searchValues.length === 0) {
      throw new BadRequestError(
        "No search values for searching medication references",
        undefined,
        additionalInfo
      );
    }
    const searchValuesWithAtLeastTwoParts = searchValues.filter(
      searchValue => searchValue.length >= 2
    );
    if (searchValuesWithAtLeastTwoParts.length === 0) {
      throw new BadRequestError(
        "No search values with at least two parts",
        undefined,
        additionalInfo
      );
    }
    const allMedicationReferences: MedicationReference[] = [];
    const searchMedicationErrors: { error: unknown; searchValue: string }[] = [];
    const searchMedicationArgs: string[] = searchValuesWithAtLeastTwoParts;
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
    return allMedicationReferences;
  }

  async searchForAllergen({
    cxId,
    patientId,
    allergyIntolerance,
  }: {
    cxId: string;
    patientId: string;
    allergyIntolerance: AllergyIntolerance;
  }): Promise<AllergenReference[]> {
    const { log, debug } = out(
      `AthenaHealth searchForAllergen - cxId ${cxId} practiceId ${this.practiceId} patientId ${patientId}`
    );
    const referenceUrl = "/reference/allergies";
    const additionalInfo = {
      cxId,
      practiceId: this.practiceId,
      patientId,
      allergyIntoleranceId: allergyIntolerance.id,
    };
    const searchValues = allergyIntolerance.code?.coding?.flatMap(c => c.display?.split("/") ?? []);
    if (!searchValues || searchValues.length === 0) {
      throw new BadRequestError(
        "No search values for searching allergy references",
        undefined,
        additionalInfo
      );
    }
    const searchValuesWithAtLeastTwoParts = searchValues.filter(
      searchValue => searchValue.length >= 2
    );
    if (searchValuesWithAtLeastTwoParts.length === 0) {
      throw new BadRequestError(
        "No search values with at least two parts",
        undefined,
        additionalInfo
      );
    }
    const allAllergenReferences: AllergenReference[] = [];
    const searchAllergenErrors: { error: unknown; searchValue: string }[] = [];
    const searchAllergenArgs: string[] = searchValuesWithAtLeastTwoParts;
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
    return allAllergenReferences;
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
}

export default AthenaHealthApi;

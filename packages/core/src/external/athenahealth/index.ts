import {
  Condition,
  Medication,
  MedicationAdministration,
  MedicationDispense,
  MedicationStatement,
  Observation,
} from "@medplum/fhirtypes";
import { AdditionalInfo, errorToString, JwtTokenInfo, MetriportError } from "@metriport/shared";
import { buildDayjs } from "@metriport/shared/common/date";
import {
  AppointmentEvents,
  appointmentEventsSchema,
  athenaClientJwtTokenResponseSchema,
  BookedAppointment,
  BookedAppointments,
  bookedAppointmentsSchema,
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
  Departments,
  departmentsSchema,
  EventType,
  FeedType,
  MedicationReference,
  medicationReferencesSchema,
  Patient,
  patientSchema,
  patientSchemaWithValidHomeAddress,
  PatientSearch,
  patientSearchSchema,
  PatientWithValidHomeAddress,
  VitalsCreateParams,
  VitalsCreateResponse,
  vitalsCreateResponseSchema,
} from "@metriport/shared/interface/external/athenahealth/index";
import { getObservationCode, getObservationUnits } from "@metriport/shared/medical";
import axios, { AxiosInstance } from "axios";
import dayjs from "dayjs";
import { uniqBy } from "lodash";
import { z } from "zod";
import { processAsyncError } from "../..//util/error/shared";
import { createHivePartitionFilePath } from "../../domain/filename";
import { fetchCodingCodeOrDisplayOrSystem } from "../../fhir-deduplication/shared";
import { executeAsynchronously } from "../../util/concurrency";
import { Config } from "../../util/config";
import { SNOMED_CODE } from "../../util/constants";
import { out } from "../../util/log";
import { capture } from "../../util/notifications";
import { uuidv7 } from "../../util/uuid-v7";
import { S3Utils } from "../aws/s3";

const parallelRequests = 5;
const delayBetweenRequestBatches = dayjs.duration(2, "seconds");

interface ApiConfig {
  twoLeggedAuthTokenInfo?: JwtTokenInfo | undefined;
  practiceId: string;
  environment: AthenaEnv;
  clientKey: string;
  clientSecret: string;
}

const region = Config.getAWSRegion();
const responsesBucket = Config.getEhrResponsesBucketName();
const athenaPracticePrefix = "Practice";
const athenaPatientPrefix = "E";
const athenaDepartmentPrefix = "Department";
const athenaDateFormat = "MM/DD/YYYY";
const athenaDateTimeFormat = "MM/DD/YYYY HH:mm:ss";

function getS3UtilsInstance(): S3Utils {
  return new S3Utils(region);
}

const problemStatusesMapAthena = new Map<string, string>();
problemStatusesMapAthena.set("relapse", "CHRONIC");
problemStatusesMapAthena.set("recurrence", "CHRONIC");
const clinicalStatusActiveCode = "55561003";
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

export type AthenaEnv = "api" | "api.preview";
export function isAthenaEnv(env: string): env is AthenaEnv {
  return env === "api" || env === "api.preview";
}

// TYPES FROM DASHBOARD
export type MedicationWithRefs = {
  medication: Medication;
  administration?: MedicationAdministration;
  dispense?: MedicationDispense;
  statement?: MedicationStatement;
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

type RequestData = { [key: string]: string | boolean | object | undefined };

export type GroupedVitals = {
  mostRecentObservation: Observation;
  sortedPoints?: DataPoint[];
};

class AthenaHealthApi {
  private axiosInstanceFhir: AxiosInstance;
  private axiosInstanceProprietary: AxiosInstance;
  private baseUrl: string;
  private twoLeggedAuthTokenInfo: JwtTokenInfo | undefined;
  private practiceId: string;
  private s3Utils: S3Utils;

  private constructor(private config: ApiConfig) {
    this.twoLeggedAuthTokenInfo = config.twoLeggedAuthTokenInfo;
    this.practiceId = this.stripPracticeId(config.practiceId);
    this.s3Utils = getS3UtilsInstance();
    this.axiosInstanceFhir = axios.create({});
    this.axiosInstanceProprietary = axios.create({});
    this.baseUrl = `https://${config.environment}.platform.athenahealth.com`;
  }

  public static async create(config: ApiConfig): Promise<AthenaHealthApi> {
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
      const response = await axios.post(url, this.createDataParams(data), {
        headers: { "content-type": "application/x-www-form-urlencoded" },
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
    } else if (this.twoLeggedAuthTokenInfo.exp < new Date()) {
      log(`Two Legged Auth token expired @ AthenaHealth - fetching new token`);
      this.twoLeggedAuthTokenInfo = await this.fetchTwoLeggedAuthToken();
    } else {
      log(`Two Legged Auth token found @ AthenaHealth - using existing token`);
    }

    const headers = {
      Authorization: `Bearer ${this.twoLeggedAuthTokenInfo.access_token}`,
      "content-type": "application/x-www-form-urlencoded",
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

  async getDepartments(cxId: string): Promise<string[]> {
    const { debug } = out(
      `AthenaHealth getDepartments - cxId ${cxId} practiceId ${this.practiceId}`
    );
    const departmentsUrl = `/departments`;
    const additionalInfo = { cxId, practiceId: this.practiceId };
    const departments = await this.makeRequest<Departments>({
      cxId,
      method: "GET",
      url: departmentsUrl,
      schema: departmentsSchema,
      additionalInfo,
      debug,
    });
    return departments.departments.map(d => d.departmentid);
  }

  async getPatient({
    cxId,
    patientId,
  }: {
    cxId: string;
    patientId: string;
  }): Promise<PatientWithValidHomeAddress | undefined> {
    const { debug } = out(
      `AthenaHealth getPatient - cxId ${cxId} practiceId ${this.practiceId} patientId ${patientId}`
    );
    const patientUrl = `/Patient/${this.createPatientId(patientId)}`;
    const additionalInfo = { cxId, practiceId: this.practiceId, patientId };
    try {
      const patient = await this.makeRequest<Patient>({
        cxId,
        patientId,
        method: "GET",
        url: patientUrl,
        schema: patientSchema,
        additionalInfo,
        debug,
        useFhir: true,
      });
      return this.parsePatient({ patient, additionalInfo });
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } catch (error: any) {
      if (error.response?.status === 404) return undefined;
      throw error;
    }
  }

  async searchPatient({
    cxId,
    patientId,
  }: {
    cxId: string;
    patientId: string;
  }): Promise<PatientWithValidHomeAddress | undefined> {
    const { debug } = out(
      `AthenaHealth searchPatient - cxId ${cxId} practiceId ${this.practiceId} patientId ${patientId}`
    );
    const searchUrl = "/Patient/_search";
    const additionalInfo = { cxId, practiceId: this.practiceId, patientId };
    const data = {
      _id: this.createPatientId(patientId),
      "ah-practice": this.createPracticetId(this.practiceId),
    };
    const searchSet = await this.makeRequest<PatientSearch>({
      cxId,
      patientId,
      method: "POST",
      data,
      url: searchUrl,
      schema: patientSearchSchema,
      additionalInfo,
      debug,
    });
    const entry = searchSet.entry;
    if (entry.length > 1) {
      throw new MetriportError("More than one patient found in search", undefined, additionalInfo);
    }
    const patient = entry[0]?.resource;
    if (!patient) return undefined;
    return this.parsePatient({ patient, additionalInfo });
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
      throw new MetriportError("No medication options found via search", undefined, additionalInfo);
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
      method: "POST",
      data,
      url: chartMedicationUrl,
      schema: createdMedicationSchema,
      additionalInfo,
      debug,
    });
    if (!createdMedication.success) {
      throw new MetriportError("Medication creation not successful", undefined, {
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
  }): Promise<CreatedProblemSuccess | undefined> {
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
    const snomedCode = this.getConditionSnomedCode(condition);
    if (!snomedCode) {
      throw new MetriportError("No SNOMED code found for condition", undefined, additionalInfo);
    }
    const startDate = this.getConditionStartDate(condition);
    if (!startDate) {
      throw new MetriportError("No start date found for condition", undefined, additionalInfo);
    }
    const conditionStatus = this.getConditionStatus(condition);
    const athenaStatus = conditionStatus
      ? problemStatusesMapAthena.get(conditionStatus.toLowerCase())
      : undefined;
    const data = {
      departmentid: this.stripDepartmentId(departmentId),
      note: "Added via Metriport App",
      snomedcode: snomedCode,
      startdate: this.formatDate(startDate),
      status: athenaStatus,
      THIRDPARTYUSERNAME: undefined,
      PATIENTFACINGCALL: undefined,
    };
    try {
      const createdProblem = await this.makeRequest<CreatedProblem>({
        cxId,
        patientId,
        method: "POST",
        data,
        url: chartProblemUrl,
        schema: createdProblemSchema,
        additionalInfo,
        debug,
      });
      if (!createdProblem.success) {
        throw new MetriportError("Problem creation not successful", undefined, {
          ...additionalInfo,
          error: createdProblem.errormessage,
        });
      }
      return createdProblemSuccessSchema.parse(createdProblem);
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } catch (error: any) {
      if (error.response?.status === 400) {
        throw new MetriportError("Problem creation not successful - duplicate problem", undefined, {
          ...additionalInfo,
          error,
        });
      }
      throw error;
    }
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
  }): Promise<VitalsCreateResponse[]> {
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
      throw new MetriportError("No code found for observation", undefined, additionalInfo);
    }
    const clinicalElementId = vitalSignCodesMapAthena.get(code);
    if (!clinicalElementId) {
      throw new MetriportError("No clinical element id found for observation", undefined, {
        ...additionalInfo,
        code,
      });
    }
    const units = getObservationUnits(observation);
    if (!units) {
      throw new MetriportError("No units found for observation", undefined, {
        ...additionalInfo,
        code,
        clinicalElementId,
      });
    }
    if (!vitals.sortedPoints || vitals.sortedPoints.length === 0) {
      throw new MetriportError("No points found for vitals", undefined, additionalInfo);
    }
    if (uniqBy(vitals.sortedPoints, "date").length !== vitals.sortedPoints.length) {
      throw new MetriportError("Duplicate reading taken for vitals", undefined, {
        ...additionalInfo,
        dates: vitals.sortedPoints.map(v => v.date).join(", "),
      });
    }
    const responses: VitalsCreateResponse[] = [];
    const rawResponses: any[] = []; // eslint-disable-line @typescript-eslint/no-explicit-any
    const createVitalsErrors: {
      error: unknown;
      cxId: string;
      practiceId: string;
      patientId: string;
      departmentId: string;
      observationId: string | undefined;
    }[] = [];
    const createVitalsArgs: VitalsCreateParams[] = vitals.sortedPoints.map(v => {
      const vitalsData = this.createVitalsData(v, clinicalElementId, units);
      return {
        departmentid: this.stripDepartmentId(departmentId),
        returnvitalsid: true,
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
          const response = await this.axiosInstanceProprietary.post(
            chartVitalsUrl,
            this.createDataParams(params)
          );
          if (!response.data) {
            throw new MetriportError(
              `No body returned from ${chartVitalsUrl}`,
              undefined,
              additionalInfo
            );
          }
          debug(`${chartVitalsUrl} resp: `, () => JSON.stringify(response.data));
          rawResponses.push(response.data);
          const outcome = vitalsCreateResponseSchema.safeParse(response.data);
          if (!outcome.success) {
            throw new MetriportError("Vitals not parsed", undefined, {
              ...additionalInfo,
              error: errorToString(outcome.error),
            });
          }
          if (!outcome.data.success) {
            throw new MetriportError("Vitals creation not successful", undefined, {
              ...additionalInfo,
              error: outcome.data.errormessage,
            });
          }
          responses.push(outcome.data);
        } catch (error) {
          createVitalsErrors.push({ error, ...additionalInfo });
        }
      },
      {
        numberOfParallelExecutions: parallelRequests,
        delay: delayBetweenRequestBatches.asMilliseconds(),
      }
    );
    if (responsesBucket) {
      const filePath = createHivePartitionFilePath({
        cxId,
        patientId,
        date: new Date(),
      });
      const key = this.buildS3Path("chart/vitals", filePath);
      this.s3Utils
        .uploadFile({
          bucket: responsesBucket,
          key,
          file: Buffer.from(
            rawResponses.map(response => JSON.stringify(response)).join("\n"),
            "utf8"
          ),
          contentType: "application/json",
        })
        .catch(processAsyncError("Error saving to s3 @ AthenaHealth - createVitals"));
    }
    if (createVitalsErrors.length > 0) {
      const msg = `Failure while creating some vitals @ AthenaHealth`;
      log(`${msg}. Cause: ${createVitalsErrors.map(error => errorToString(error)).join(", ")}`);
      capture.error(msg, {
        extra: {
          url: chartVitalsUrl,
          cxId,
          practiceId: this.practiceId,
          patientId,
          departmentId,
          observationId: observation.id,
          context: "athenahealth.create-vitals",
          errors: createVitalsErrors,
        },
      });
    }
    if (responses.length === 0) {
      throw new MetriportError("No vitals created", undefined, additionalInfo);
    }
    return responses;
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
      `AthenaHealth search for medication - cxId ${cxId} practiceId ${this.practiceId} patientId ${patientId}`
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
      throw new MetriportError(
        "No code display values for searching medication references",
        undefined,
        additionalInfo
      );
    }
    const searchValuesWithAtLeastTwoParts = searchValues.filter(
      searchValue => searchValue.length >= 2
    );
    if (searchValuesWithAtLeastTwoParts.length === 0) {
      throw new MetriportError(
        "No search values with at least two parts",
        undefined,
        additionalInfo
      );
    }
    const responses: MedicationReference[] = [];
    const rawResponses: any[] = []; // eslint-disable-line @typescript-eslint/no-explicit-any
    const searchMedicationErrors: {
      error: unknown;
      cxId: string;
      practiceId: string;
      patientId: string;
      medicationId: string | undefined;
    }[] = [];
    const searchMedicationArgs: string[] = searchValuesWithAtLeastTwoParts;
    await executeAsynchronously(
      searchMedicationArgs,
      async (searchValue: string) => {
        try {
          const response = await this.axiosInstanceProprietary.get(
            `${referenceUrl}?searchvalue=${searchValue}`
          );
          if (!response.data) {
            throw new MetriportError(
              `No body returned from ${referenceUrl}`,
              undefined,
              additionalInfo
            );
          }
          debug(`${referenceUrl} resp: `, () => JSON.stringify(response.data));
          rawResponses.push(response.data);
          const outcome = medicationReferencesSchema.safeParse(response.data);
          if (!outcome.success) {
            throw new MetriportError("Medication references not parsed", undefined, {
              ...additionalInfo,
              error: errorToString(outcome.error),
            });
          }
          responses.push(...outcome.data);
        } catch (error) {
          searchMedicationErrors.push({ error, ...additionalInfo });
        }
      },
      {
        numberOfParallelExecutions: parallelRequests,
        delay: delayBetweenRequestBatches.asMilliseconds(),
      }
    );
    if (responsesBucket) {
      const filePath = createHivePartitionFilePath({
        cxId,
        patientId,
        date: new Date(),
      });
      const key = this.buildS3Path("reference/medications", filePath);
      this.s3Utils
        .uploadFile({
          bucket: responsesBucket,
          key,
          file: Buffer.from(
            rawResponses.map(response => JSON.stringify(response)).join("\n"),
            "utf8"
          ),
          contentType: "application/json",
        })
        .catch(processAsyncError("Error saving to s3 @ AthenaHealth - searchForMedication"));
    }
    if (searchMedicationErrors.length > 0) {
      const msg = `Failure while searching for medications @ AthenaHealth`;
      log(`${msg}. Cause: ${searchMedicationErrors.map(error => errorToString(error)).join(", ")}`);
      capture.error(msg, {
        extra: {
          cxId,
          practiceId: this.practiceId,
          patientId,
          context: "athenahealth.search-for-medication",
          errors: searchMedicationErrors,
        },
      });
    }
    return responses;
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
      method: "POST",
      data: eventType ? { eventname: eventType } : {},
      url: subscribeUrl,
      schema: createdSubscriptionSchema,
      additionalInfo,
      debug,
    });
    if (!createdSubscription.success) {
      throw new MetriportError(`Subscription not successful`, undefined, additionalInfo);
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
    };
    const urlParams = new URLSearchParams(params);
    if (departmentIds && departmentIds.length > 0) {
      departmentIds.map(dpId => urlParams.append("departmentid", this.stripDepartmentId(dpId)));
    } else {
      const fetchedDepartmentIds = await this.getDepartments(cxId);
      fetchedDepartmentIds.map(dpId =>
        urlParams.append("departmentid", this.stripDepartmentId(dpId))
      );
    }
    const appointmentUrl = `/appointments/booked/multipledepartment?${urlParams.toString()}`;
    const additionalInfo = {
      cxId,
      practiceId: this.practiceId,
      departmentIds: departmentIds?.join(","),
      startAppointmentDate: startAppointmentDate.toISOString(),
      endAppointmentDate: endAppointmentDate.toISOString(),
    };
    const bookedAppointments = await this.makeRequest<BookedAppointments>({
      cxId,
      method: "GET",
      url: appointmentUrl,
      schema: bookedAppointmentsSchema,
      additionalInfo,
      debug,
    });
    return bookedAppointments.appointments;
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
    const { debug } = out(
      `AthenaHealth getAppointmentsFromSubscription - cxId ${cxId} practiceId ${this.practiceId} departmentIds ${departmentIds}`
    );
    const params = {
      showprocessedstartdatetime: startProcessedDate
        ? this.formatDateTime(startProcessedDate.toISOString()) ?? ""
        : "",
      showprocessedenddatetime: endProcessedDate
        ? this.formatDateTime(endProcessedDate.toISOString()) ?? ""
        : "",
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
    const appointmentEvents = await this.makeRequest<AppointmentEvents>({
      cxId,
      method: "GET",
      url: appointmentUrl,
      schema: appointmentEventsSchema,
      additionalInfo,
      debug,
    });
    const bookedAppointments = appointmentEvents.appointments.filter(
      app => app.patientid !== undefined && app.appointmentstatus === "f"
    ) as BookedAppointment[];
    return bookedAppointments;
  }

  private async makeRequest<T>({
    cxId,
    patientId,
    url,
    method,
    data,
    schema,
    additionalInfo,
    debug,
    useFhir = false,
  }: {
    cxId: string;
    patientId?: string;
    url: string;
    method: "GET" | "POST";
    data?: RequestData;
    schema: z.Schema;
    additionalInfo: AdditionalInfo;
    debug: typeof console.log;
    useFhir?: boolean;
  }): Promise<T> {
    const axiosInstance = useFhir ? this.axiosInstanceFhir : this.axiosInstanceProprietary;
    const response = await axiosInstance.request({
      method,
      url,
      data: this.createDataParams(data ?? {}),
    });
    if (!response.data) {
      throw new MetriportError(`No body returned from ${method} ${url}`, undefined, additionalInfo);
    }
    const body = response.data;
    debug(`${method} ${url} resp: `, () => JSON.stringify(response.data));
    if (responsesBucket) {
      const filePath = createHivePartitionFilePath({
        cxId,
        patientId: patientId ?? "global",
        date: new Date(),
      });
      const key = this.buildS3Path(method, filePath);
      this.s3Utils
        .uploadFile({
          bucket: responsesBucket,
          key,
          file: Buffer.from(JSON.stringify(response.data), "utf8"),
          contentType: "application/json",
        })
        .catch(processAsyncError(`Error saving to s3 @ AthenaHealth - ${method} ${url}`));
    }
    const outcome = schema.safeParse(body);
    if (!outcome.success) {
      throw new MetriportError(`${method} ${url} response not parsed`, undefined, {
        ...additionalInfo,
        error: errorToString(outcome.error),
      });
    }
    return outcome.data;
  }

  private createDataParams(data: RequestData): string {
    const dataParams = new URLSearchParams();
    Object.entries(data).forEach(([k, v]) => {
      if (v === undefined) return;
      dataParams.append(k, typeof v === "object" ? JSON.stringify(v) : v.toString());
    });
    return dataParams.toString();
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

  private buildS3Path(method: string, key: string): string {
    return `athenahealth/${method}/${key}/${uuidv7()}.json`;
  }

  private formatDate(date: string | undefined): string | undefined {
    if (!date) return undefined;
    const trimmedDate = date.trim();
    const parsedDate = buildDayjs(trimmedDate);
    if (!parsedDate.isValid()) return undefined;
    return parsedDate.format(athenaDateFormat);
  }

  private formatDateTime(date: string | undefined): string | undefined {
    if (!date) return undefined;
    const trimmedDate = date.trim();
    const parsedDate = buildDayjs(trimmedDate);
    if (!parsedDate.isValid()) return undefined;
    return parsedDate.format(athenaDateTimeFormat);
  }

  private parsePatient({
    patient,
    additionalInfo,
  }: {
    patient: Patient;
    additionalInfo: Record<string, string>;
  }): PatientWithValidHomeAddress {
    if (!patient.address) {
      throw new MetriportError("No addresses found", undefined, additionalInfo);
    }
    patient.address = patient.address.filter(a => a.postalCode !== undefined && a.use === "home");
    if (patient.address.length === 0) {
      throw new MetriportError("No home address with valid zip found", undefined, additionalInfo);
    }
    return patientSchemaWithValidHomeAddress.parse(patient);
  }

  private getConditionSnomedCode(condition: Condition): string | undefined {
    const code = condition.code;
    const snomedCoding = code?.coding?.find(coding => {
      const system = fetchCodingCodeOrDisplayOrSystem(coding, "system");
      return system?.includes(SNOMED_CODE);
    });
    if (!snomedCoding) return undefined;
    return snomedCoding.code;
  }

  private getConditionStartDate(condition: Condition): string | undefined {
    return condition.onsetDateTime ?? condition.onsetPeriod?.start;
  }

  private getConditionStatus(condition: Condition): string | undefined {
    return condition.clinicalStatus?.text ??
      condition.clinicalStatus?.coding?.[0]?.display ??
      condition.clinicalStatus?.coding?.[0]?.code === clinicalStatusActiveCode
      ? "Active"
      : condition.clinicalStatus?.coding?.[0]?.code;
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
    if (units === "g" || units.includes("gram")) return value; // https://hl7.org/fhir/R4/valueset-ucum-bodyweight.html
    if (units === "cm" || units.includes("centimeter")) return value; // https://hl7.org/fhir/R4/valueset-ucum-bodylength.html
    if (units === "degf" || units === "f" || units.includes("fahrenheit")) return value; // https://hl7.org/fhir/R4/valueset-ucum-bodytemp.html
    if (units === "lb_av" || units.includes("pound")) return this.convertLbsToGrams(value); // https://hl7.org/fhir/R4/valueset-ucum-bodyweight.html
    if (units === "kg" || units.includes("kilogram")) return this.convertKiloGramsToGrams(value); // https://hl7.org/fhir/R4/valueset-ucum-bodyweight.html
    if (units === "in_i" || units.includes("inch")) return this.convertInchesToCm(value); // https://hl7.org/fhir/R4/valueset-ucum-bodylength.html
    if (units === "cel" || units === "c" || units.includes("celsius")) {
      return this.convertCelciusToFahrenheit(value); // https://hl7.org/fhir/R4/valueset-ucum-bodytemp.html
    }
    throw new MetriportError("Unknown units", undefined, {
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

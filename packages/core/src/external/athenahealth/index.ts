import {
  Condition,
  Medication,
  MedicationAdministration,
  MedicationDispense,
  MedicationStatement,
  Observation,
} from "@medplum/fhirtypes";
import { errorToString, MetriportError } from "@metriport/shared";
import { buildDayjs } from "@metriport/shared/common/date";
import {
  appointmentEventGetResponseSchema,
  BookedAppointment,
  bookedAppointmentsGetResponseSchema,
  departmentsGetResponseSchema,
  EventType,
  FeedType,
  MedicationCreateResponse,
  medicationCreateResponseSchema,
  MedicationReference,
  medicationReferencesGetResponseSchema,
  PatientResource,
  patientResourceSchema,
  patientSearchResourceSchema,
  ProblemCreateResponse,
  problemCreateResponseSchema,
  subscriptionCreateResponseSchema,
  athenaClientJwtTokenResponseSchema,
  VitalsCreateParams,
  VitalsCreateResponse,
  vitalsCreateResponseSchema,
} from "@metriport/shared/interface/external/athenahealth/index";
import axios, { AxiosInstance } from "axios";
import dayjs from "dayjs";
import { uniqBy } from "lodash";
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
  twoLeggedAuthToken?: string | undefined;
  threeLeggedAuthToken?: string | undefined;
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

const problemStatusesAthena = ["CHRONIC", "ACUTE"];
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

export type GroupedVitals = {
  mostRecentObservation: Observation;
  sortedPoints?: DataPoint[];
};

class AthenaHealthApi {
  private axiosInstanceFhirApi: AxiosInstance;
  private axiosInstanceProprietary: AxiosInstance;
  private baseUrl: string;
  private twoLeggedAuthToken: string | undefined;
  private twoLeggedAuthTokenExp: number | undefined;
  private threeLeggedAuthToken: string | undefined;
  private practiceId: string;
  private s3Utils: S3Utils;

  private constructor(private config: ApiConfig) {
    this.twoLeggedAuthToken = config.twoLeggedAuthToken;
    this.threeLeggedAuthToken = config.threeLeggedAuthToken;
    this.practiceId = this.stripPracticeId(config.practiceId);
    this.s3Utils = getS3UtilsInstance();
    this.axiosInstanceFhirApi = axios.create({});
    this.axiosInstanceProprietary = axios.create({});
    this.baseUrl = `https://${config.environment}.platform.athenahealth.com`;
  }

  public static async create(config: ApiConfig): Promise<AthenaHealthApi> {
    const instance = new AthenaHealthApi(config);
    await instance.initialize();
    return instance;
  }

  getTwoLeggedAuthTokenInfo():
    | {
        token: string;
        exp: number;
      }
    | undefined {
    if (!this.twoLeggedAuthToken || !this.twoLeggedAuthTokenExp) return undefined;
    return {
      token: this.twoLeggedAuthToken,
      exp: this.twoLeggedAuthTokenExp,
    };
  }

  private async fetchTwoLeggedAuthToken(): Promise<void> {
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
      this.twoLeggedAuthToken = tokenData.access_token;
      this.twoLeggedAuthTokenExp = new Date(Date.now() + +tokenData.expires_in * 1000).getTime();
    } catch (error) {
      throw new MetriportError("Failed to fetch Two Legged Auth token @ AthenaHealth", undefined, {
        error: errorToString(error),
      });
    }
  }

  async initialize(): Promise<void> {
    if (!this.twoLeggedAuthToken) await this.fetchTwoLeggedAuthToken();

    this.axiosInstanceFhirApi = axios.create({
      baseURL: `${this.baseUrl}/fhir/r4`,
      headers: {
        accept: "application/json",
        Authorization: `Bearer ${this.threeLeggedAuthToken ?? this.twoLeggedAuthToken}`,
        "content-type": "application/x-www-form-urlencoded",
      },
    });

    this.axiosInstanceProprietary = axios.create({
      baseURL: `${this.baseUrl}/v1/${this.practiceId}`,
      headers: {
        Authorization: `Bearer ${this.twoLeggedAuthToken}`,
        "content-type": "application/x-www-form-urlencoded",
      },
    });
  }

  async getDepartments({ cxId }: { cxId: string }): Promise<string[]> {
    const { log, debug } = out(
      `AthenaHealth get departments - cxId ${cxId} practiceId ${this.practiceId}`
    );
    const departmentUrl = `/departments`;
    try {
      const additionalInfo = { cxId, practiceId: this.practiceId };
      const response = await this.axiosInstanceProprietary.get(departmentUrl);
      if (!response.data) {
        throw new MetriportError(
          `No body returned from ${departmentUrl}`,
          undefined,
          additionalInfo
        );
      }
      debug(`${departmentUrl} resp: `, () => JSON.stringify(response.data));
      if (responsesBucket) {
        const filePath = createHivePartitionFilePath({
          cxId,
          patientId: "global",
          date: new Date(),
        });
        const key = this.buildS3Path("departments", filePath);
        this.s3Utils
          .uploadFile({
            bucket: responsesBucket,
            key,
            file: Buffer.from(JSON.stringify(response.data), "utf8"),
            contentType: "application/json",
          })
          .catch(processAsyncError("Error saving to s3 @ AthenaHealth - getDepartments"));
      }
      const outcome = departmentsGetResponseSchema.safeParse(response.data);
      if (!outcome.success) {
        throw new MetriportError("Departments not parsed", undefined, {
          ...additionalInfo,
          error: errorToString(outcome.error),
        });
      }
      return outcome.data.departments.map(d => d.departmentid);
    } catch (error) {
      const msg = `Failure while getting departments @ AthenaHealth`;
      log(`${msg}. Cause: ${errorToString(error)}`);
      capture.error(msg, {
        extra: {
          url: departmentUrl,
          cxId,
          practiceId: this.practiceId,
          context: "athenahealth.get-departments",
          error,
        },
      });
      throw error;
    }
  }

  async getPatient({
    cxId,
    patientId,
  }: {
    cxId: string;
    patientId: string;
  }): Promise<PatientResource | undefined> {
    const { log, debug } = out(
      `AthenaHealth get patient - cxId ${cxId} practiceId ${this.practiceId} patientId ${patientId}`
    );
    const patientUrl = `/Patient/${this.createPatientId(patientId)}`;
    try {
      const additionalInfo = { cxId, practiceId: this.practiceId, patientId };
      const response = await this.axiosInstanceFhirApi.get(patientUrl);
      if (!response.data) {
        throw new MetriportError(`No body returned from ${patientUrl}`, undefined, additionalInfo);
      }
      debug(`${patientUrl} resp: `, () => JSON.stringify(response.data));
      if (responsesBucket) {
        const filePath = createHivePartitionFilePath({
          cxId,
          patientId,
          date: new Date(),
        });
        const key = this.buildS3Path("patient", filePath);
        this.s3Utils
          .uploadFile({
            bucket: responsesBucket,
            key,
            file: Buffer.from(JSON.stringify(response.data), "utf8"),
            contentType: "application/json",
          })
          .catch(processAsyncError("Error saving to s3 @ AthenaHealth - getPatient"));
      }
      const patient = patientResourceSchema.safeParse(response.data);
      if (!patient.success) {
        const error = patient.error;
        const msg = "Patient from AthenaHealth could not be parsed";
        log(`${msg} - error ${errorToString(error)}`);
        capture.message(msg, {
          extra: {
            url: patientUrl,
            cxId,
            practiceId: this.practiceId,
            patientId,
            error,
            context: "athenahealth.get-patient",
          },
          level: "info",
        });
        return undefined;
      }
      return patient.data;
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } catch (error: any) {
      if (error.response?.status === 404) return undefined;
      const msg = `Failure while getting patient @ AthenaHealth`;
      log(`${msg}. Cause: ${errorToString(error)}`);
      capture.error(msg, {
        extra: {
          url: patientUrl,
          cxId,
          practiceId: this.practiceId,
          patientId,
          context: "athenahealth.get-patient",
          error,
        },
      });
      throw error;
    }
  }

  async getPatientViaSearch({
    cxId,
    patientId,
  }: {
    cxId: string;
    patientId: string;
  }): Promise<PatientResource | undefined> {
    const { log, debug } = out(
      `AthenaHealth search patient - cxId ${cxId} practiceId ${this.practiceId} patientId ${patientId}`
    );
    const patientSearchUrl = "/Patient/_search";
    try {
      const data = {
        _id: this.createPatientId(patientId),
        "ah-practice": this.createPracticetId(this.practiceId),
      };
      const additionalInfo = { cxId, practiceId: this.practiceId, patientId };
      const response = await this.axiosInstanceFhirApi.post(
        patientSearchUrl,
        this.createDataParams(data)
      );
      if (!response.data) {
        throw new MetriportError(
          `No body returned from ${patientSearchUrl}`,
          undefined,
          additionalInfo
        );
      }
      debug(`${patientSearchUrl} resp: `, () => JSON.stringify(response.data));
      if (responsesBucket) {
        const filePath = createHivePartitionFilePath({
          cxId,
          patientId,
          date: new Date(),
        });
        const key = this.buildS3Path("patient-search", filePath);
        this.s3Utils
          .uploadFile({
            bucket: responsesBucket,
            key,
            file: Buffer.from(JSON.stringify(response.data), "utf8"),
            contentType: "application/json",
          })
          .catch(processAsyncError("Error saving to s3 @ AthenaHealth - getPatientViaSearch"));
      }
      const searchSet = patientSearchResourceSchema.safeParse(response.data);
      if (!searchSet.success) {
        const error = searchSet.error;
        const msg = "Patient search set from AthenaHealth could not be parsed";
        log(`${msg} - error ${errorToString(error)}`);
        capture.message(msg, {
          extra: {
            url: patientSearchUrl,
            cxId,
            practiceId: this.practiceId,
            patientId,
            error,
            context: "athenahealth.get-patient",
          },
          level: "info",
        });
        return undefined;
      }
      const entry = searchSet.data.entry;
      if (entry.length > 1) {
        throw new MetriportError(
          "More than one AthenaHealth patient found",
          undefined,
          additionalInfo
        );
      }
      return entry[0]?.resource;
    } catch (error) {
      const msg = `Failure while searching patient @ AthenaHealth`;
      log(`${msg}. Cause: ${errorToString(error)}`);
      capture.error(msg, {
        extra: {
          url: patientSearchUrl,
          cxId,
          practiceId: this.practiceId,
          patientId,
          context: "athenahealth.get-patient",
          error,
        },
      });
      throw error;
    }
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
  }): Promise<MedicationCreateResponse> {
    const { log, debug } = out(
      `AthenaHealth create medication - cxId ${cxId} practiceId ${this.practiceId} patientId ${patientId} departmentId ${departmentId}`
    );
    const chartMedicationUrl = `/chart/${this.stripPatientId(patientId)}/medications`;
    try {
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
        throw new MetriportError(
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
      const response = await this.axiosInstanceProprietary.post(
        chartMedicationUrl,
        this.createDataParams(data)
      );
      if (!response.data) {
        throw new MetriportError(
          `No body returned from ${chartMedicationUrl}`,
          undefined,
          additionalInfo
        );
      }
      debug(`${chartMedicationUrl} resp: `, () => JSON.stringify(response.data));
      if (responsesBucket) {
        const filePath = createHivePartitionFilePath({
          cxId,
          patientId,
          date: new Date(),
        });
        const key = this.buildS3Path("chart/medication", filePath);
        this.s3Utils
          .uploadFile({
            bucket: responsesBucket,
            key,
            file: Buffer.from(JSON.stringify(response.data), "utf8"),
            contentType: "application/json",
          })
          .catch(processAsyncError("Error saving to s3 @ AthenaHealth - createMedication"));
      }
      const outcome = medicationCreateResponseSchema.safeParse(response.data);
      if (!outcome.success) {
        throw new MetriportError("Medication not parsed", undefined, {
          ...additionalInfo,
          error: errorToString(outcome.error),
        });
      }
      if (!outcome.data.success) {
        throw new MetriportError("Medication creation not successful", undefined, {
          ...additionalInfo,
          error: outcome.data.errormessage,
        });
      }
      return outcome.data;
    } catch (error) {
      const msg = `Failure while creating medication @ AthenaHealth`;
      log(`${msg}. Cause: ${errorToString(error)}`);
      capture.error(msg, {
        extra: {
          url: chartMedicationUrl,
          cxId,
          practiceId: this.practiceId,
          patientId,
          departmentId,
          context: "athenahealth.create-medication",
          error,
        },
      });
      throw error;
    }
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
  }): Promise<ProblemCreateResponse> {
    const { log, debug } = out(
      `AthenaHealth create problem - cxId ${cxId} practiceId ${this.practiceId} patientId ${patientId} departmentId ${departmentId}`
    );
    const chartProblemUrl = `/chart/${this.stripPatientId(patientId)}/problems`;
    try {
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
        ? problemStatusesAthena.find(
            status => status.toLowerCase() === conditionStatus.toLowerCase()
          )
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
      const response = await this.axiosInstanceProprietary.post(
        chartProblemUrl,
        this.createDataParams(data)
      );
      if (!response.data) {
        throw new MetriportError(
          `No body returned from ${chartProblemUrl}`,
          undefined,
          additionalInfo
        );
      }
      debug(`${chartProblemUrl} resp: `, () => JSON.stringify(response.data));
      if (responsesBucket) {
        const filePath = createHivePartitionFilePath({
          cxId,
          patientId,
          date: new Date(),
        });
        const key = this.buildS3Path("chart/problem", filePath);
        this.s3Utils
          .uploadFile({
            bucket: responsesBucket,
            key,
            file: Buffer.from(JSON.stringify(response.data), "utf8"),
            contentType: "application/json",
          })
          .catch(processAsyncError("Error saving to s3 @ AthenaHealth - createProblem"));
      }
      const outcome = problemCreateResponseSchema.safeParse(response.data);
      if (!outcome.success) {
        throw new MetriportError("Problem not parsed", undefined, {
          ...additionalInfo,
          error: errorToString(outcome.error),
        });
      }
      if (!outcome.data.success) {
        throw new MetriportError("Problem creation not successful", undefined, {
          ...additionalInfo,
          error: outcome.data.errormessage,
        });
      }
      return outcome.data;
    } catch (error) {
      const msg = `Failure while creating problem @ AthenaHealth`;
      log(`${msg}. Cause: ${errorToString(error)}`);
      capture.error(msg, {
        extra: {
          url: chartProblemUrl,
          cxId,
          practiceId: this.practiceId,
          patientId,
          departmentId,
          context: "athenahealth.create-problem",
          error,
        },
      });
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
      `AthenaHealth create vitals - cxId ${cxId} practiceId ${this.practiceId} patientId ${patientId} departmentId ${departmentId}`
    );
    const chartVitalsUrl = `/chart/${this.stripPatientId(patientId)}/vitals`;
    try {
      const observation = vitals.mostRecentObservation;
      const additionalInfo = {
        cxId,
        practiceId: this.practiceId,
        patientId,
        departmentId,
        observationId: observation.id,
      };
      const code = this.getObservationCode(observation);
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
      const units = this.getObservationUnits(observation);
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
    } catch (error) {
      const msg = `Failure while creating some vitals @ AthenaHealth`;
      log(`${msg}. Cause: ${errorToString(error)}`);
      capture.error(msg, {
        extra: {
          url: chartVitalsUrl,
          cxId,
          practiceId: this.practiceId,
          patientId,
          departmentId,
          context: "athenahealth.create-vitals",
          error,
        },
      });
      throw error;
    }
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
    try {
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
            const outcome = medicationReferencesGetResponseSchema.safeParse(response.data);
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
        log(
          `${msg}. Cause: ${searchMedicationErrors.map(error => errorToString(error)).join(", ")}`
        );
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
    } catch (error) {
      const msg = `Failure while searching for medications @ AthenaHealth`;
      log(`${msg}. Cause: ${errorToString(error)}`);
      capture.error(msg, {
        extra: {
          cxId,
          practiceId: this.practiceId,
          patientId,
          context: "athenahealth.search-for-medication",
          error,
        },
      });
      throw error;
    }
  }

  async subscribeToEvent({
    cxId,
    feedtype,
    eventType,
  }: {
    cxId: string;
    feedtype: FeedType;
    eventType?: EventType;
  }): Promise<void> {
    const { log, debug } = out(
      `AthenaHealth subscribe to event - cxId ${cxId} practiceId ${this.practiceId} feedtype ${feedtype}`
    );
    const subscribeUrl = `/${feedtype}/changed/subscription`;
    try {
      const response = await this.axiosInstanceProprietary.post(
        subscribeUrl,
        eventType ? this.createDataParams({ eventname: eventType }) : {}
      );
      const additionalInfo = {
        cxId,
        practiceId: this.practiceId,
        feedtype,
        eventType,
      };
      if (!response.data) {
        throw new MetriportError(
          `No body returned from ${subscribeUrl}`,
          undefined,
          additionalInfo
        );
      }
      debug(`${subscribeUrl} resp: `, () => JSON.stringify(response.data));
      if (responsesBucket) {
        const filePath = createHivePartitionFilePath({
          cxId,
          patientId: "global",
          date: new Date(),
        });
        const key = this.buildS3Path("subscribe", filePath);
        this.s3Utils
          .uploadFile({
            bucket: responsesBucket,
            key,
            file: Buffer.from(JSON.stringify(response.data), "utf8"),
            contentType: "application/json",
          })
          .catch(processAsyncError("Error saving to s3 @ AthenaHealth - subscribeToEvent"));
      }
      const outcome = subscriptionCreateResponseSchema.safeParse(response.data);
      if (!outcome.success) {
        throw new MetriportError("Subscription not parsed", undefined, {
          ...additionalInfo,
          error: errorToString(outcome.error),
        });
      }
      if (!outcome.data.success) {
        throw new MetriportError(
          `Subscription for ${feedtype} not successful`,
          undefined,
          additionalInfo
        );
      }
    } catch (error) {
      const msg = `Failure while subscribing to event @ AthenaHealth`;
      log(`${msg}. Cause: ${errorToString(error)}`);
      capture.error(msg, {
        extra: {
          url: subscribeUrl,
          cxId,
          practiceId: this.practiceId,
          feedtype,
          context: "athenahealth.subscribe-to-event",
          error,
        },
      });
      throw error;
    }
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
    const { log, debug } = out(
      `AthenaHealth get appointments - cxId ${cxId} practiceId ${this.practiceId} departmentIds ${departmentIds}`
    );
    const params = {
      startdate: this.formatDate(startAppointmentDate.toISOString()) ?? "",
      enddate: this.formatDate(endAppointmentDate.toISOString()) ?? "",
    };
    const urlParams = new URLSearchParams(params);
    if (departmentIds && departmentIds.length > 0) {
      departmentIds.map(dpId => urlParams.append("departmentid", this.stripDepartmentId(dpId)));
    } else {
      const fetchedDepartmentIds = await this.getDepartments({ cxId });
      fetchedDepartmentIds.map(dpId =>
        urlParams.append("departmentid", this.stripDepartmentId(dpId))
      );
    }
    const appointmentUrl = `/appointments/booked/multipledepartment?${urlParams.toString()}`;
    try {
      const additionalInfo = {
        cxId,
        practiceId: this.practiceId,
        departmentIds: departmentIds?.join(","),
        startAppointmentDate: startAppointmentDate.toISOString(),
        endAppointmentDate: endAppointmentDate.toISOString(),
      };
      const response = await this.axiosInstanceProprietary.get(appointmentUrl);
      if (!response.data) {
        throw new MetriportError(
          `No body returned from ${appointmentUrl}`,
          undefined,
          additionalInfo
        );
      }
      debug(`${appointmentUrl} resp: `, () => JSON.stringify(response.data));
      if (responsesBucket) {
        const filePath = createHivePartitionFilePath({
          cxId,
          patientId: "global",
          date: new Date(),
        });
        const key = this.buildS3Path("appointments", filePath);
        this.s3Utils
          .uploadFile({
            bucket: responsesBucket,
            key,
            file: Buffer.from(JSON.stringify(response.data), "utf8"),
            contentType: "application/json",
          })
          .catch(processAsyncError("Error saving to s3 @ AthenaHealth - getAppointments"));
      }
      const outcome = bookedAppointmentsGetResponseSchema.safeParse(response.data);
      if (!outcome.success) {
        throw new MetriportError("Appointments not parsed", undefined, {
          ...additionalInfo,
          error: errorToString(outcome.error),
        });
      }
      return outcome.data.appointments;
    } catch (error) {
      const msg = `Failure while getting appointments @ AthenaHealth`;
      log(`${msg}. Cause: ${errorToString(error)}`);
      capture.error(msg, {
        extra: {
          url: appointmentUrl,
          cxId,
          practiceId: this.practiceId,
          departmentIds,
          context: "athenahealth.get-appointments",
          error,
        },
      });
      throw error;
    }
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
      `AthenaHealth get appointments from sub - cxId ${cxId} practiceId ${this.practiceId} departmentIds ${departmentIds}`
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
    try {
      const additionalInfo = {
        cxId,
        practiceId: this.practiceId,
        departmentIds: departmentIds?.join(","),
        startProcessedDate: startProcessedDate?.toISOString(),
        endProcessedDate: endProcessedDate?.toISOString(),
      };
      const response = await this.axiosInstanceProprietary.get(appointmentUrl);
      if (!response.data) {
        throw new MetriportError(
          `No body returned from ${appointmentUrl}`,
          undefined,
          additionalInfo
        );
      }
      debug(`${appointmentUrl} resp: `, () => JSON.stringify(response.data));
      if (responsesBucket) {
        const filePath = createHivePartitionFilePath({
          cxId,
          patientId: "global",
          date: new Date(),
        });
        const key = this.buildS3Path("appointments-changed", filePath);
        this.s3Utils
          .uploadFile({
            bucket: responsesBucket,
            key,
            file: Buffer.from(JSON.stringify(response.data), "utf8"),
            contentType: "application/json",
          })
          .catch(
            processAsyncError("Error saving to s3 @ AthenaHealth - getAppointmentsFromSubscription")
          );
      }
      const outcome = appointmentEventGetResponseSchema.safeParse(response.data);
      if (!outcome.success) {
        throw new MetriportError("Appointments from subscription not parsed", undefined, {
          ...additionalInfo,
          error: errorToString(outcome.error),
        });
      }
      return outcome.data.appointments.filter(
        app => app.patientid !== undefined && app.appointmentstatus === "f"
      ) as BookedAppointment[];
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } catch (error: any) {
      if (error.response?.status === 403) {
        // 403 indicates no existing subscription so we create one
        log(`Subscribing to appointment event for cxId ${cxId}`);
        await this.subscribeToEvent({
          cxId,
          feedtype: "appointments",
          eventType: "ScheduleAppointment",
        });
        return [];
      }
      const msg = `Failure while getting appointments from subscription @ AthenaHealth`;
      log(`${msg}. Cause: ${errorToString(error)}`);
      capture.error(msg, {
        extra: {
          url: appointmentUrl,
          cxId,
          practiceId: this.practiceId,
          departmentIds,
          context: "athenahealth.get-appointments",
          error,
        },
      });
      throw error;
    }
  }

  private createDataParams(data: { [key: string]: string | boolean | object | undefined }): string {
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

  private getObservationCode(observation: Observation): string | undefined {
    return observation.code?.coding?.[0]?.code;
  }

  private getObservationUnits(observation: Observation): string | undefined {
    return observation.valueQuantity?.unit?.replace(/[{()}]/g, "").toLowerCase();
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

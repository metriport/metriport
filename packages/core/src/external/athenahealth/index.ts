import axios, { AxiosInstance } from "axios";
import {
  Medication,
  MedicationAdministration,
  MedicationDispense,
  MedicationStatement,
} from "@medplum/fhirtypes";
import {
  patientResourceSchema,
  patientSearchResourceSchema,
  PatientResource,
  MedicationReference,
  medicationReferencesGetResponseSchema,
  MedicationCreateResponse,
  medicationCreateResponseSchema,
  BookedAppointment,
  bookedAppointmentsGetResponseSchema,
  subscriptionCreateResponseSchema,
  departmentsGetResponseSchema,
  FeedType,
} from "@metriport/shared";
import { errorToString, NotFoundError } from "@metriport/shared";
import { buildDayjs } from "@metriport/shared/common/date";
import { S3Utils } from "../aws/s3";
import { out } from "../../util/log";
import { capture } from "../../util/notifications";
import { Config } from "../../util/config";
import { uuidv7 } from "../../util/uuid-v7";
import { createHivePartitionFilePath } from "../../domain/filename";
import { processAsyncError } from "../..//util/error/shared";

interface ApiConfig {
  threeLeggedAuthToken: string | undefined;
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

export type AthenaEnv = "api" | "api.preview";

export type MedicationWithRefs = {
  medication: Medication;
  administration?: MedicationAdministration;
  dispense?: MedicationDispense;
  statement?: MedicationStatement;
};

class AthenaHealthApi {
  private axiosInstanceFhirApi: AxiosInstance;
  private axiosInstanceProprietary: AxiosInstance;
  private baseUrl: string;
  private twoLeggedAuthToken: string;
  private threeLeggedAuthToken: string | undefined;
  private practiceId: string;
  private s3Utils: S3Utils;

  private constructor(private config: ApiConfig) {
    this.twoLeggedAuthToken = "";
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

  private async fetchtwoLeggedAuthToken(): Promise<void> {
    const url = `${this.baseUrl}/oauth2/v1/token`;
    const payload = `grant_type=client_credentials&scope=athena/service/Athenanet.MDP.* system/Patient.read`;

    try {
      const response = await axios.post(url, payload, {
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        auth: {
          username: this.config.clientKey,
          password: this.config.clientSecret,
        },
      });

      this.twoLeggedAuthToken = response.data.access_token;
    } catch (error) {
      throw new Error("Failed to fetch Two Legged Auth token");
    }
  }

  async initialize(): Promise<void> {
    await this.fetchtwoLeggedAuthToken();

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
      const response = await this.axiosInstanceProprietary.get(departmentUrl);
      if (!response.data) throw new Error(`No body returned from ${departmentUrl}`);
      debug(`${departmentUrl} resp: ${JSON.stringify(response.data)}`);
      if (responsesBucket) {
        const filePath = createHivePartitionFilePath({
          cxId,
          patientId: "global",
          date: new Date(),
        });
        const key = `athenahealth/departments/${filePath}/${uuidv7()}.json`;
        this.s3Utils
          .uploadFile({
            bucket: responsesBucket,
            key,
            file: Buffer.from(JSON.stringify(response.data), "utf8"),
            contentType: "application/json",
          })
          .catch(processAsyncError("Error saving to s3 @ AthenaHealth - getDepartments"));
      }
      const deparments = departmentsGetResponseSchema.parse(response.data);
      return deparments.departments.map(d => d.departmentid);
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
      const response = await this.axiosInstanceFhirApi.get(patientUrl);
      if (!response.data) throw new Error(`No body returned from ${patientUrl}`);
      debug(`${patientUrl} resp: ${JSON.stringify(response.data)}`);
      if (responsesBucket) {
        const filePath = createHivePartitionFilePath({
          cxId,
          patientId,
          date: new Date(),
        });
        const key = `athenahealth/patient/${filePath}/${uuidv7()}.json`;
        this.s3Utils
          .uploadFile({
            bucket: responsesBucket,
            key,
            file: Buffer.from(JSON.stringify(response.data), "utf8"),
            contentType: "application/json",
          })
          .catch(processAsyncError("Error saving to s3 @ AthenaHealth - getPatient"));
      }
      return patientResourceSchema.parse(response.data);
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
      const response = await this.axiosInstanceFhirApi.post(
        patientSearchUrl,
        this.createDataParams(data)
      );
      if (!response.data) throw new Error(`No body returned from ${patientSearchUrl}`);
      debug(`${patientSearchUrl} resp: ${JSON.stringify(response.data)}`);
      if (responsesBucket) {
        const filePath = createHivePartitionFilePath({
          cxId,
          patientId,
          date: new Date(),
        });
        const key = `athenahealth/patient-search/${filePath}/${uuidv7()}.json`;
        this.s3Utils
          .uploadFile({
            bucket: responsesBucket,
            key,
            file: Buffer.from(JSON.stringify(response.data), "utf8"),
            contentType: "application/json",
          })
          .catch(processAsyncError("Error saving to s3 @ AthenaHealth - getPatientViaSearch"));
      }
      const searchSet = patientSearchResourceSchema.parse(response.data);
      if (searchSet.entry.length > 1) {
        throw new NotFoundError("More than one AthenaHealth patient found");
      }
      return searchSet.entry[0]?.resource;
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
    const medicationOptions = await this.searchForMedication({
      cxId,
      patientId,
      medication: medication.medication,
    });
    if (medicationOptions.length === 0) throw new Error("No medication options found");
    const data = {
      departmentid: this.stripDepartmentId(departmentId),
      providernote: "Added via Metriport App",
      unstructuredsig: "Metriport",
      medicationid: `${medicationOptions[0]?.medicationid}`,
      hidden: "false",
      startdate: this.formatDate(medication.statement?.effectivePeriod?.start),
      stopdate: this.formatDate(medication.statement?.effectivePeriod?.end),
      stopreason: undefined,
      patientnote: undefined,
      THIRDPARTYUSERNAME: undefined,
      PATIENTFACINGCALL: undefined,
    };
    const chartMedicationUrl = `/chart/${this.stripPatientId(patientId)}/medications`;
    try {
      const response = await this.axiosInstanceProprietary.post(
        chartMedicationUrl,
        this.createDataParams(data)
      );
      if (!response.data) throw new Error(`No body returned from ${chartMedicationUrl}`);
      debug(`${chartMedicationUrl} resp: ${JSON.stringify(response.data)}`);
      if (responsesBucket) {
        const filePath = createHivePartitionFilePath({
          cxId,
          patientId,
          date: new Date(),
        });
        const key = `athenahealth/chart/medication/${filePath}/${uuidv7()}.json`;
        this.s3Utils
          .uploadFile({
            bucket: responsesBucket,
            key,
            file: Buffer.from(JSON.stringify(response.data), "utf8"),
            contentType: "application/json",
          })
          .catch(processAsyncError("Error saving to s3 @ AthenaHealth - createMedication"));
      }
      return medicationCreateResponseSchema.parse(response.data);
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
    const searchValues = medication.code?.coding?.flatMap(c => c.display?.split("/") ?? []);
    if (!searchValues) throw Error("No code displays values for searching medications.");
    const medicationOptions: MedicationReference[] = [];
    await Promise.all(
      searchValues.map(async searchValue => {
        if (searchValue.length < 2) return;
        const referenceUrl = `/reference/medications?searchvalue=${searchValue}`;
        try {
          const response = await this.axiosInstanceProprietary.get(referenceUrl);
          if (!response.data) throw new Error(`No body returned from ${referenceUrl}`);
          debug(`${referenceUrl} resp: ${JSON.stringify(response.data)}`);
          const medications = medicationReferencesGetResponseSchema.parse(response.data);
          medicationOptions.push(...medications);
        } catch (error) {
          const msg = `Failure while searching for medications @ AthenaHealth`;
          log(`${msg}. Cause: ${errorToString(error)}`);
          capture.error(msg, {
            extra: {
              url: referenceUrl,
              cxId,
              practiceId: this.practiceId,
              patientId,
              context: "athenahealth.search-for-medication",
              error,
            },
          });
          throw error;
        }
      })
    );
    if (responsesBucket) {
      const filePath = createHivePartitionFilePath({
        cxId,
        patientId,
        date: new Date(),
      });
      const key = `athenahealth/reference/medications/${filePath}/${uuidv7()}.json`;
      this.s3Utils
        .uploadFile({
          bucket: responsesBucket,
          key,
          file: Buffer.from(JSON.stringify(medicationOptions), "utf8"),
          contentType: "application/json",
        })
        .catch(processAsyncError("Error saving to s3 @ AthenaHealth - searchForMedication"));
    }
    return medicationOptions;
  }

  async subscribeToEvent({ cxId, feedtype }: { cxId: string; feedtype: FeedType }): Promise<void> {
    const { log, debug } = out(
      `AthenaHealth subscribe to event - cxId ${cxId} practiceId ${this.practiceId} feedtype ${feedtype}`
    );
    const subscribeUrl = `/${feedtype}/changed/subscription`;
    try {
      const response = await this.axiosInstanceProprietary.post(subscribeUrl, {});
      if (!response.data) throw new Error(`No body returned from ${subscribeUrl}`);
      debug(`${subscribeUrl} resp: ${JSON.stringify(response.data)}`);
      if (responsesBucket) {
        const filePath = createHivePartitionFilePath({
          cxId,
          patientId: "global",
          date: new Date(),
        });
        const key = `athenahealth/subscribe/${filePath}/${uuidv7()}.json`;
        this.s3Utils
          .uploadFile({
            bucket: responsesBucket,
            key,
            file: Buffer.from(JSON.stringify(response.data), "utf8"),
            contentType: "application/json",
          })
          .catch(processAsyncError("Error saving to s3 @ AthenaHealth - subscribeToEvent"));
      }
      const outcome = subscriptionCreateResponseSchema.parse(response.data);
      if (!outcome.success) throw new Error(`Subscription for ${feedtype} not successful`);
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
      const response = await this.axiosInstanceProprietary.get(appointmentUrl);
      if (!response.data) throw new Error(`No body returned from ${appointmentUrl}`);
      debug(`${appointmentUrl} resp: ${JSON.stringify(response.data)}`);
      if (responsesBucket) {
        const filePath = createHivePartitionFilePath({
          cxId,
          patientId: "global",
          date: new Date(),
        });
        const key = `athenahealth/appointments/${filePath}/${uuidv7()}.json`;
        this.s3Utils
          .uploadFile({
            bucket: responsesBucket,
            key,
            file: Buffer.from(JSON.stringify(response.data), "utf8"),
            contentType: "application/json",
          })
          .catch(processAsyncError("Error saving to s3 @ AthenaHealth - getAppointments"));
      }
      const appointments = bookedAppointmentsGetResponseSchema.parse(response.data).appointments;
      return appointments.filter(app => app.patientid !== undefined);
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
    startLastModifiedDate,
    endLastModifiedDate,
  }: {
    cxId: string;
    departmentIds?: string[];
    startLastModifiedDate?: Date;
    endLastModifiedDate?: Date;
  }): Promise<BookedAppointment[]> {
    const { log, debug } = out(
      `AthenaHealth get appointments from sub - cxId ${cxId} practiceId ${this.practiceId} departmentIds ${departmentIds}`
    );
    const params = {
      showprocessedstartdatetime: startLastModifiedDate
        ? this.formatDateTime(startLastModifiedDate.toISOString()) ?? ""
        : "",
      showprocessedenddatetime: endLastModifiedDate
        ? this.formatDateTime(endLastModifiedDate.toISOString()) ?? ""
        : "",
    };
    const urlParams = new URLSearchParams(params);
    if (departmentIds && departmentIds.length > 0) {
      departmentIds.map(dpId => urlParams.append("departmentid", this.stripDepartmentId(dpId)));
    }
    const appointmentUrl = `/appointments/changed?${urlParams.toString()}`;
    try {
      const response = await this.axiosInstanceProprietary.get(appointmentUrl);
      if (!response.data) throw new Error(`No body returned from ${appointmentUrl}`);
      debug(`${appointmentUrl} resp: ${JSON.stringify(response.data)}`);
      if (responsesBucket) {
        const filePath = createHivePartitionFilePath({
          cxId,
          patientId: "global",
          date: new Date(),
        });
        const key = `athenahealth/appointments-changed/${filePath}/${uuidv7()}.json`;
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
      const appointments = bookedAppointmentsGetResponseSchema.parse(response.data).appointments;
      return appointments.filter(
        app => app.appointmentstatus === "f" && app.patientid !== undefined
      );
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } catch (error: any) {
      if (error.response?.status === 403) {
        log(`Subscribing to appointment event for cxId ${cxId}`);
        await this.subscribeToEvent({
          cxId,
          feedtype: "appointments",
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

  private createDataParams(data: { [key: string]: string | undefined }): string {
    return Object.entries(data)
      .flatMap(([k, v]) => (v ? [`${k}=${v}`] : []))
      .join("&");
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
}

export default AthenaHealthApi;

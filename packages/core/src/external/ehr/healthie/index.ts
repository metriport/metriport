import { MetriportError, NotFoundError } from "@metriport/shared";
import {
  AppointmentListGraphqlResponse,
  appointmentListGraphqlResponseSchema,
  AppointmentWithAttendee,
  PatientGraphql,
  patientGraphqlSchema,
  PatientQuickNotesGraphql,
  patientQuickNotesGraphqlSchema,
} from "@metriport/shared/interface/external/ehr/healthie/index";
import { EhrSources } from "@metriport/shared/interface/external/ehr/source";
import axios, { AxiosInstance } from "axios";
import { out } from "../../../util/log";
import { ApiConfig, formatDate, makeRequest, MakeRequestParamsInEhr } from "../shared";

interface HealthieApiConfig
  extends Omit<ApiConfig, "twoLeggedAuthTokenInfo" | "clientKey" | "clientSecret"> {
  apiKey: string;
  environment: HealthieEnv;
}

const healthieDateFormat = "YYYY-MM-DD";

const healthieEnv = ["api", "staging-api"] as const;
export type HealthieEnv = (typeof healthieEnv)[number];
export function isHealthieEnv(env: string): env is HealthieEnv {
  return healthieEnv.includes(env as HealthieEnv);
}

class HealthieApi {
  private axiosInstance: AxiosInstance;
  private baseUrl: string;
  private apiKey: string;
  private practiceId: string;

  private constructor(config: HealthieApiConfig) {
    this.apiKey = config.apiKey;
    this.practiceId = config.practiceId;
    this.axiosInstance = axios.create({});
    this.baseUrl = `https://${config.environment}.gethealthie.com/graphql`;
  }

  public static async create(config: HealthieApiConfig): Promise<HealthieApi> {
    const instance = new HealthieApi(config);
    await instance.initialize();
    return instance;
  }

  async initialize(): Promise<void> {
    const { log } = out(`Healthie initialize - practiceId ${this.practiceId}`);
    if (!this.apiKey) {
      log(`API key not found @ Healthie`);
      throw new MetriportError("API key not found @ Healthie");
    }

    const headers = {
      Authorization: `Basic ${this.apiKey}`,
      "Content-Type": "application/json",
    };

    this.axiosInstance = axios.create({ baseURL: `${this.baseUrl}`, headers });
  }

  async getPatient({
    cxId,
    patientId,
  }: {
    cxId: string;
    patientId: string;
  }): Promise<PatientGraphql> {
    const { debug } = out(
      `Healthie getPatient - cxId ${cxId} practiceId ${this.practiceId} patientId ${patientId}`
    );
    const additionalInfo = { cxId, practiceId: this.practiceId, patientId };
    const operationName = "getUser";
    const query = `query getUser($id: ID) {
      user(id: $id) {
        id
        first_name
        last_name
        dob
        gender
        email
        phone_number
        next_appt_date
      }
    }`;
    const variables = { id: patientId };
    const patient = await this.makeRequest<PatientGraphql>({
      cxId,
      patientId: patientId.toString(),
      s3Path: "patient",
      operationName,
      query,
      variables,
      schema: patientGraphqlSchema,
      additionalInfo,
      debug,
    });
    if (!patient.data.user) throw new NotFoundError("Patient not found", undefined, additionalInfo);
    return patient;
  }

  async getPatientQuickNotes({
    cxId,
    patientId,
  }: {
    cxId: string;
    patientId: string;
  }): Promise<string | undefined> {
    const { debug } = out(
      `Healthie getPatientQuickNotes - cxId ${cxId} practiceId ${this.practiceId} patientId ${patientId}`
    );
    const additionalInfo = { cxId, practiceId: this.practiceId, patientId };
    const operationName = "getUser";
    const query = `query getUser($id: ID) {
      user(id: $id) {
        id
        quick_notes
      }
    }`;
    const variables = { id: patientId };
    const patient = await this.makeRequest<PatientQuickNotesGraphql>({
      cxId,
      patientId: patientId.toString(),
      s3Path: "patient",
      operationName,
      query,
      variables,
      schema: patientQuickNotesGraphqlSchema,
      additionalInfo,
      debug,
    });
    if (!patient.data.user)
      throw new NotFoundError("Patient quick notes not found", undefined, additionalInfo);
    return patient.data.user.quick_notes ?? undefined;
  }

  async updatePatientQuickNotesWithLink({
    cxId,
    patientId,
    link,
  }: {
    cxId: string;
    patientId: string;
    link: string;
  }): Promise<void> {
    const { debug } = out(
      `Healthie updatePatientQuickNote - cxId ${cxId} practiceId ${this.practiceId} patientId ${patientId}`
    );
    const additionalInfo = { cxId, practiceId: this.practiceId, patientId };
    const existingQuickNotes = await this.getPatientQuickNotes({ cxId, patientId });
    const operationName = "updateClient";
    const query = `mmutation updateClient($id: ID, $quick_notes: String) {
      updateClient(
        input: { id: $id, quick_notes: $quick_notes }
      ) {
        user {
          id
          quick_notes
        }
        messages {
          field
          message
        }
      }
    }`;
    // TODO Remove existingQuickNotes and link from the mutation
    const variables = {
      id: patientId,
      quick_notes: `${existingQuickNotes ?? ""}<br><br>${link}`,
    };
    await this.makeRequest<PatientGraphql>({
      cxId,
      patientId: patientId.toString(),
      s3Path: "patient",
      operationName,
      query,
      variables,
      schema: patientGraphqlSchema,
      additionalInfo,
      debug,
    });
  }

  async getAppointments({
    cxId,
    startAppointmentDate,
    endAppointmentDate,
  }: {
    cxId: string;
    startAppointmentDate: Date;
    endAppointmentDate: Date;
  }): Promise<AppointmentWithAttendee[]> {
    const { debug } = out(`Healthie getAppointments - cxId ${cxId} practiceId ${this.practiceId}`);
    const additionalInfo = {
      cxId,
      practiceId: this.practiceId,
      startAppointmentDate: startAppointmentDate.toISOString(),
      endAppointmentDate: endAppointmentDate.toISOString(),
    };
    const operationName = "appointments";
    const query = `query appointments(
      $startDate: String
      $endDate: String
      $order_by: AppointmentOrderKeys
      $should_paginate: Boolean
      $offset: Int
      $is_active: Boolean
    ) {
      appointments(
        startDate: $startDate
        endDate: $endDate
        order_by: $order_by
        should_paginate: $should_paginate
        offset: $offset
        is_active: $is_active
        is_org: true
      ) {
        id
        attendees {
          id
        }
        appointment_type {
          id
        }
      }
    }`;
    const variables = {
      startDate: this.formatDate(startAppointmentDate.toISOString()) ?? "",
      endDate: this.formatDate(endAppointmentDate.toISOString()) ?? "",
      order_by: "CREATED_AT_ASC",
      should_paginate: true,
      offset: 0,
      is_active: true,
    };
    const appointmentListGraphqlResponse = await this.makeRequest<AppointmentListGraphqlResponse>({
      cxId,
      s3Path: "patient",
      operationName,
      query,
      variables,
      schema: appointmentListGraphqlResponseSchema,
      additionalInfo,
      debug,
    });
    const appointments = appointmentListGraphqlResponse.data.appointments;
    return appointments.map(appointment => {
      const attendee = appointment.attendees[0];
      if (!attendee) {
        throw new MetriportError("Appointment has no attendees", undefined, additionalInfo);
      }
      return { ...appointment, attendees: [attendee] };
    });
  }

  async getAppointment({
    cxId,
    appointmentId,
  }: {
    cxId: string;
    appointmentId: string;
  }): Promise<AppointmentWithAttendee> {
    const { debug } = out(
      `Healthie getAppointment - cxId ${cxId} practiceId ${this.practiceId} appointmentId ${appointmentId}`
    );
    const additionalInfo = {
      cxId,
      practiceId: this.practiceId,
      appointmentId,
    };
    const operationName = "appointments";
    const query = `query appointments(
      $id: String
      $is_active: Boolean
    ) {
      appointments(
        id: $id
        is_active: $is_active
        is_org: true
      ) {
        id
        attendees {
          id
        }
        appointment_type {
          id
        }
      }
    }`;
    const variables = {
      id: appointmentId,
      is_active: true,
    };
    const appointmentGraphqlResponse = await this.makeRequest<AppointmentListGraphqlResponse>({
      cxId,
      s3Path: "patient",
      operationName,
      query,
      variables,
      schema: appointmentListGraphqlResponseSchema,
      additionalInfo,
      debug,
    });
    const appointment = appointmentGraphqlResponse.data.appointments[0];
    if (!appointment) throw new NotFoundError("Appointment not found", undefined, additionalInfo);
    const attendee = appointment.attendees[0];
    if (!attendee) {
      throw new MetriportError("Appointment has no attendees", undefined, additionalInfo);
    }
    return { ...appointment, attendees: [attendee] };
  }

  private async makeRequest<T>({
    cxId,
    patientId,
    s3Path,
    operationName,
    query,
    variables,
    schema,
    additionalInfo,
    debug,
  }: Omit<MakeRequestParamsInEhr<T>, "method" | "url" | "data" | "headers"> & {
    operationName: string;
    query: string;
    variables: Record<string, string | number | boolean>;
  }): Promise<T> {
    return await makeRequest<T>({
      ehr: EhrSources.healthie,
      cxId,
      practiceId: this.practiceId,
      patientId,
      s3Path,
      axiosInstance: this.axiosInstance,
      url: "",
      method: "POST",
      data: { operationName, query, variables },
      schema,
      additionalInfo,
      debug,
    });
  }

  private formatDate(date: string | undefined): string | undefined {
    return formatDate(date, healthieDateFormat);
  }
}

export default HealthieApi;

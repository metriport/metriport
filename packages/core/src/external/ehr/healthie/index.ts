import { MetriportError, NotFoundError } from "@metriport/shared";
import {
  AppointmentGetResponseGraphql,
  appointmentGetResponseGraphqlSchema,
  AppointmentListResponseGraphql,
  appointmentListResponseGraphqlSchema,
  AppointmentWithAttendee,
  Patient,
  PatientGraphql,
  patientGraphqlSchema,
  PatientQuickNotesGraphql,
  patientQuickNotesGraphqlSchema,
  PatientUpdateQuickNotesGraphql,
  patientUpdateQuickNotesGraphqlSchema,
  Subscription,
  SubscriptionListResponseGraphql,
  subscriptionListResponseGraphqlSchema,
  SubscriptionResource,
  SubscriptionWithSignatureSecret,
  SubscriptionWithSignatureSecretGraphql,
  subscriptionWithSignatureSecretGraphqlSchema,
} from "@metriport/shared/interface/external/ehr/healthie/index";
import { EhrSources } from "@metriport/shared/interface/external/ehr/source";
import axios, { AxiosInstance } from "axios";
import { Config } from "../../../util/config";
import { out } from "../../../util/log";
import {
  ApiConfig,
  formatDate,
  GetSecretsApiKeyFunction,
  makeRequest,
  MakeRequestParamsInEhr,
} from "../shared";

const apiUrl = Config.getApiUrl();

interface HealthieApiConfig
  extends Omit<ApiConfig, "twoLeggedAuthTokenInfo" | "clientKey" | "clientSecret" | "getSecrets"> {
  getSecrets?: GetSecretsApiKeyFunction;
  apiKey?: string | undefined;
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
  private apiKey: string | undefined;
  private getSecrets: GetSecretsApiKeyFunction | undefined;
  private practiceId: string;

  private constructor(config: HealthieApiConfig) {
    this.apiKey = config.apiKey;
    this.practiceId = config.practiceId;
    this.axiosInstance = axios.create({});
    this.baseUrl = `https://${config.environment}.gethealthie.com/graphql`;
    this.getSecrets = config.getSecrets;
  }

  public static async create(config: HealthieApiConfig): Promise<HealthieApi> {
    const instance = new HealthieApi(config);
    await instance.initialize();
    return instance;
  }

  async initialize(): Promise<void> {
    if (!this.apiKey) {
      if (!this.getSecrets) {
        throw new MetriportError(
          "getSecrets function is required if apiKey is not provided",
          undefined,
          {
            ehr: EhrSources.healthie,
          }
        );
      }
      const secrets = await this.getSecrets();
      this.apiKey = secrets.apiKey;
    }

    const headers = {
      Authorization: `Basic ${this.apiKey}`,
      AuthorizationSource: "API",
      "Content-Type": "application/json",
    };

    this.axiosInstance = axios.create({ baseURL: `${this.baseUrl}`, headers });
  }

  async getPatient({ cxId, patientId }: { cxId: string; patientId: string }): Promise<Patient> {
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
        locations {
          id
          name
          line1
          line2
          city
          state
          zip
          country
        }
      }
    }`;
    const variables = { id: patientId };
    const patientGraphql = await this.makeRequest<PatientGraphql>({
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
    if (!patientGraphql.data.user) {
      throw new NotFoundError("Patient not found", undefined, additionalInfo);
    }
    return patientGraphql.data.user;
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
    const patientQuickNotesGraphql = await this.makeRequest<PatientQuickNotesGraphql>({
      cxId,
      patientId: patientId.toString(),
      s3Path: "patient-quick-notes",
      operationName,
      query,
      variables,
      schema: patientQuickNotesGraphqlSchema,
      additionalInfo,
      debug,
    });
    if (!patientQuickNotesGraphql.data.user) {
      throw new NotFoundError("Patient quick notes not found", undefined, additionalInfo);
    }
    return patientQuickNotesGraphql.data.user.quick_notes ?? undefined;
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
    const linkElement = `<p><a href="${link}" target="_blank">Metriport Integration</a></p>`;
    const scrubbedExistingQuickNotes = existingQuickNotes?.replace(
      /<p><a .*>Metriport Integration<\/a><\/p>/g,
      ""
    );
    const operationName = "updateClient";
    const query = `mutation updateClient($id: ID, $quick_notes: String) {
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
    const variables = {
      id: patientId,
      quick_notes: `${scrubbedExistingQuickNotes ?? ""}${linkElement}`,
    };
    const patientUpdateQuickNotesGraphql = await this.makeRequest<PatientUpdateQuickNotesGraphql>({
      cxId,
      patientId: patientId.toString(),
      s3Path: "patient-update-quick-notes",
      operationName,
      query,
      variables,
      schema: patientUpdateQuickNotesGraphqlSchema,
      additionalInfo,
      debug,
    });
    if (!patientUpdateQuickNotesGraphql.data.updateClient.user) {
      throw new MetriportError("Patient quick notes not updated", undefined, additionalInfo);
    }
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
    async function paginateAppointments(
      api: HealthieApi,
      cursor: string | null,
      acc: AppointmentWithAttendee[] | undefined = []
    ): Promise<AppointmentWithAttendee[]> {
      const operationName = "appointments";
      const query = `query appointments(
        $startDate: String
        $endDate: String
        ${cursor ? `$after: Cursor` : ""}
      ) {
        appointments(
          startDate: $startDate
          endDate: $endDate
          order_by: CREATED_AT_ASC
          should_paginate: true
          page_size: 1000
          is_active: true
          is_org: true
          ${cursor ? `after: $after` : ""}
        ) {
          id
          attendees {
            id
          }
          appointment_type {
            id
          }
          cursor
        }
      }`;
      const variables = {
        startDate: api.formatDate(startAppointmentDate.toISOString()) ?? "",
        endDate: api.formatDate(endAppointmentDate.toISOString()) ?? "",
        ...(cursor ? { after: cursor } : {}),
      };
      const appointmentListResponseGraphql = await api.makeRequest<AppointmentListResponseGraphql>({
        cxId,
        s3Path: "appointments",
        operationName,
        query,
        variables,
        schema: appointmentListResponseGraphqlSchema,
        additionalInfo,
        debug,
      });
      const appointments = appointmentListResponseGraphql.data.appointments;
      if (!appointments) {
        throw new NotFoundError("Appointments not found", undefined, additionalInfo);
      }
      const appointmentsWithAttendees: AppointmentWithAttendee[] = appointments.flatMap(
        appointment => {
          const attendee = appointment.attendees[0];
          if (!attendee) return [];
          return [{ ...appointment, attendees: [attendee], cursor: appointment.cursor }];
        }
      );
      acc.push(...appointmentsWithAttendees);
      const lastAppointment = appointments[appointments.length - 1];
      if (!lastAppointment) return acc;
      const nextCursor = lastAppointment.cursor;
      return paginateAppointments(api, nextCursor, acc);
    }
    const appointments = await paginateAppointments(this, null);
    return appointments;
  }

  async getAppointment({
    cxId,
    appointmentId,
  }: {
    cxId: string;
    appointmentId: string;
  }): Promise<AppointmentWithAttendee | undefined> {
    const { debug } = out(
      `Healthie getAppointment - cxId ${cxId} practiceId ${this.practiceId} appointmentId ${appointmentId}`
    );
    const additionalInfo = {
      cxId,
      practiceId: this.practiceId,
      appointmentId,
    };
    const operationName = "getAppointment";
    const query = `query getAppointment($id: ID) {
      appointment(id: $id) {
        id
        attendees {
          id
        }
        appointment_type {
          id
        }
        cursor
      }
    }`;
    const variables = { id: appointmentId };
    const appointmentGetResponseGraphql = await this.makeRequest<AppointmentGetResponseGraphql>({
      cxId,
      s3Path: "appointment",
      operationName,
      query,
      variables,
      schema: appointmentGetResponseGraphqlSchema,
      additionalInfo,
      debug,
    });
    const appointment = appointmentGetResponseGraphql.data.appointment;
    if (!appointment) throw new NotFoundError("Appointment not found", undefined, additionalInfo);
    const attendee = appointment.attendees[0];
    if (!attendee) return undefined;
    return { ...appointment, attendees: [attendee] };
  }

  async getSubscriptions({ cxId }: { cxId: string }): Promise<Subscription[]> {
    const { debug } = out(`Healthie getSubscriptions - cxId ${cxId} practiceId ${this.practiceId}`);
    const additionalInfo = { cxId, practiceId: this.practiceId };
    const operationName = "webhooks";
    const query = `query webhooks() {
      webhooks(
        order_by: CREATED_AT_ASC
      ) {
        id
        event_type
        is_enabled
        should_retry
        url
        webhook_events {
          id
          event_type
        }
      }
    }`;
    const variables = {};
    const subscriptionListResponseGraphql = await this.makeRequest<SubscriptionListResponseGraphql>(
      {
        cxId,
        s3Path: "subscriptions",
        operationName,
        query,
        variables,
        schema: subscriptionListResponseGraphqlSchema,
        additionalInfo,
        debug,
      }
    );
    if (!subscriptionListResponseGraphql.data.webhooks) {
      throw new MetriportError("Subscriptions not found", undefined, additionalInfo);
    }
    return subscriptionListResponseGraphql.data.webhooks;
  }

  async subscribeToResource({
    cxId,
    resource,
  }: {
    cxId: string;
    resource: SubscriptionResource;
  }): Promise<SubscriptionWithSignatureSecret> {
    const { debug } = out(
      `Healthie subscribeToResource - cxId ${cxId} practiceId ${this.practiceId} resource ${resource}`
    );
    const additionalInfo = { cxId, practiceId: this.practiceId, resource };
    const url = `${apiUrl}/ehr/webhook/healthie?practiceId=${this.practiceId}`;
    const existingSubscriptions = await this.getSubscriptions({ cxId });
    if (
      existingSubscriptions.some(subscription => {
        const isUrlMatch = subscription.url === url;
        const isResourceMatch =
          subscription.event_type === resource ||
          subscription.webhook_events?.some(event => event.event_type === resource);
        return isUrlMatch && isResourceMatch;
      })
    ) {
      throw new MetriportError(
        "Subscription already exists for resource",
        undefined,
        additionalInfo
      );
    }
    const operationName = "createWebhook";
    const query = `mutation createWebhook($input: createWebhookInput) {
      createWebhook(input: $input) {
        webhook {
          id
          event_type
          is_enabled
          should_retry
          url
          webhook_events {
            id
            event_type
          }
          signature_secret
        }
        messages {
          field
          message
        }
      }
    }`;
    const data = {
      is_enabled: true,
      should_retry: true,
      url,
      webhook_events: [
        {
          event_type: resource,
        },
      ],
    };
    const variables = { input: data };
    const subscription = await this.makeRequest<SubscriptionWithSignatureSecretGraphql>({
      cxId,
      s3Path: `${resource}-subscribe`,
      operationName,
      query,
      variables,
      schema: subscriptionWithSignatureSecretGraphqlSchema,
      additionalInfo,
      debug,
    });
    if (!subscription.data.createWebhook.webhook) {
      throw new MetriportError("Subscription not created", undefined, additionalInfo);
    }
    return subscription.data.createWebhook.webhook;
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
    variables: Record<string, string | number | boolean | object>;
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

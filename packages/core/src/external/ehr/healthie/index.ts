import { ResourceType } from "@medplum/fhirtypes";
import { MetriportError, NotFoundError, sleep } from "@metriport/shared";
import { normalizeGenderSafe, unknownGender } from "@metriport/shared/domain/gender";
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
  makeRequest,
  MakeRequestParamsInEhr,
  paginateWaitTime,
} from "../shared";

export const supportedHealthieResources: ResourceType[] = [
  "MedicationRequest",
  "MedicationStatement",
  "Observation",
];
export const supportedHealthieReferenceResources: ResourceType[] = [
  "Medication",
  "Location",
  "Organization",
  "Patient",
  "Practitioner",
];

export type SupportedHealthieResource = (typeof supportedHealthieResources)[number];
export function isSupportedHealthieResource(
  resourceType: string
): resourceType is SupportedHealthieResource {
  return supportedHealthieResources.includes(resourceType as ResourceType);
}

export type SupportedHealthieReferenceResource =
  (typeof supportedHealthieReferenceResources)[number];
export function isSupportedHealthieReferenceResource(
  resourceType: string
): resourceType is SupportedHealthieReferenceResource {
  return supportedHealthieReferenceResources.includes(resourceType as ResourceType);
}

interface HealthieApiConfig
  extends Omit<ApiConfig, "twoLeggedAuthTokenInfo" | "clientKey" | "clientSecret"> {
  apiKey: string;
  environment: HealthieEnv;
}

const healthieDateFormat = "YYYY-MM-DD";
const defaultCountOrLimit = 1000;

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
    return this.formatPatient(patientGraphql.data.user);
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
          page_size: ${defaultCountOrLimit}
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
      await sleep(paginateWaitTime.asMilliseconds());
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
          return [
            {
              ...appointment,
              attendees: [attendee, ...appointment.attendees.slice(1)],
            },
          ];
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
    return { ...appointment, attendees: [attendee, ...appointment.attendees.slice(1)] };
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
    const apiUrl = Config.getApiUrl();
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

  private formatPatient(patient: Patient): Patient {
    return {
      ...patient,
      gender: patient.gender ? normalizeGenderSafe(patient.gender) ?? unknownGender : unknownGender,
    };
  }

  async getMedications({ cxId, patientId }: { cxId: string; patientId: string }): Promise<void> {
    const { debug } = out(
      `Healthie getMedications - cxId ${cxId} practiceId ${this.practiceId} patientId ${patientId}`
    );
    const additionalInfo = { cxId, practiceId: this.practiceId, patientId };
    const operationName = "getMedications";
    const query = `query getMedications($userId: ID!) {
      medications(user_id: $userId) {
        id
        name
        dosage
        frequency
        start_date
        end_date
        status
      }
    }`;
    const variables = { userId: patientId };

    await this.makeRequest<SubscriptionWithSignatureSecretGraphql>({
      cxId,
      patientId: patientId.toString(),
      s3Path: "medications",
      operationName,
      query,
      variables,
      schema: subscriptionWithSignatureSecretGraphqlSchema,
      additionalInfo,
      debug,
    });
  }
  /*
  async getImmunizations({
    cxId,
    patientId,
  }: {
    cxId: string;
    patientId: string;
  }): Promise<fhir4.Immunization[]> {
    const { debug } = out(
      `Healthie getImmunizations - cxId ${cxId} practiceId ${this.practiceId} patientId ${patientId}`
    );
    const additionalInfo = { cxId, practiceId: this.practiceId, patientId };
    const operationName = "getImmunizations";
    const query = `query getImmunizations($userId: ID!) {
      immunizations(user_id: $userId) {
        id
        name
        date_given
        lot_number
        manufacturer
        administered_by {
          id
          first_name
          last_name
        }
        location {
          id
          name
          address
        }
      }
    }`;
    const variables = { userId: patientId };
    
    const response = await this.makeRequest<{ immunizations: any[] }>({
      cxId,
      patientId: patientId.toString(),
      s3Path: "immunizations",
      operationName,
      query,
      variables,
      schema: z.object({ immunizations: z.array(z.any()) }),
      additionalInfo,
      debug,
    });

    return response.immunizations.map(imm => this.convertImmunizationToFhir(imm));
  }

  async getAllergies({
    cxId,
    patientId,
  }: {
    cxId: string;
    patientId: string;
  }): Promise<fhir4.AllergyIntolerance[]> {
    const { debug } = out(
      `Healthie getAllergies - cxId ${cxId} practiceId ${this.practiceId} patientId ${patientId}`
    );
    const additionalInfo = { cxId, practiceId: this.practiceId, patientId };
    const operationName = "getAllergies";
    const query = `query getAllergies($userId: ID!) {
      allergies(user_id: $userId) {
        id
        name
        severity
        reaction
        onset_date
        status
        notes
      }
    }`;
    const variables = { userId: patientId };
    
    const response = await this.makeRequest<{ allergies: any[] }>({
      cxId,
      patientId: patientId.toString(),
      s3Path: "allergies",
      operationName,
      query,
      variables,
      schema: z.object({ allergies: z.array(z.any()) }),
      additionalInfo,
      debug,
    });

    return response.allergies.map(allergy => this.convertAllergyToFhir(allergy));
  }

  async getConditions({
    cxId,
    patientId,
  }: {
    cxId: string;
    patientId: string;
  }): Promise<fhir4.Condition[]> {
    const { debug } = out(
      `Healthie getConditions - cxId ${cxId} practiceId ${this.practiceId} patientId ${patientId}`
    );
    const additionalInfo = { cxId, practiceId: this.practiceId, patientId };
    const operationName = "getConditions";
    const query = `query getConditions($userId: ID!) {
      conditions(user_id: $userId) {
        id
        name
        diagnosis_date
        status
        severity
        notes
        diagnosed_by {
          id
          first_name
          last_name
        }
      }
    }`;
    const variables = { userId: patientId };
    
    const response = await this.makeRequest<{ conditions: any[] }>({
      cxId,
      patientId: patientId.toString(),
      s3Path: "conditions",
      operationName,
      query,
      variables,
      schema: z.object({ conditions: z.array(z.any()) }),
      additionalInfo,
      debug,
    });

    return response.conditions.map(condition => this.convertConditionToFhir(condition));
  }

  async getLabResults({
    cxId,
    patientId,
  }: {
    cxId: string;
    patientId: string;
  }): Promise<fhir4.Observation[]> {
    const { debug } = out(
      `Healthie getLabResults - cxId ${cxId} practiceId ${this.practiceId} patientId ${patientId}`
    );
    const additionalInfo = { cxId, practiceId: this.practiceId, patientId };
    const operationName = "getLabResults";
    const query = `query getLabResults($userId: ID!) {
      lab_results(user_id: $userId) {
        id
        test_name
        result_value
        unit
        reference_range
        date_taken
        status
        lab {
          id
          name
          address
        }
        ordered_by {
          id
          first_name
          last_name
        }
      }
    }`;
    const variables = { userId: patientId };
    
    const response = await this.makeRequest<{ lab_results: any[] }>({
      cxId,
      patientId: patientId.toString(),
      s3Path: "lab_results",
      operationName,
      query,
      variables,
      schema: z.object({ lab_results: z.array(z.any()) }),
      additionalInfo,
      debug,
    });

    return response.lab_results.map(lab => this.convertLabResultToFhir(lab));
  }

  async getVitals({
    cxId,
    patientId,
  }: {
    cxId: string;
    patientId: string;
  }): Promise<fhir4.Observation[]> {
    const { debug } = out(
      `Healthie getVitals - cxId ${cxId} practiceId ${this.practiceId} patientId ${patientId}`
    );
    const additionalInfo = { cxId, practiceId: this.practiceId, patientId };
    const operationName = "getVitals";
    const query = `query getVitals($userId: ID!) {
      vitals(user_id: $userId) {
        id
        vital_type
        value
        unit
        date_taken
        notes
        taken_by {
          id
          first_name
          last_name
        }
      }
    }`;
    const variables = { userId: patientId };
    
    const response = await this.makeRequest<{ vitals: any[] }>({
      cxId,
      patientId: patientId.toString(),
      s3Path: "vitals",
      operationName,
      query,
      variables,
      schema: z.object({ vitals: z.array(z.any()) }),
      additionalInfo,
      debug,
    });

    return response.vitals.map(vital => this.convertVitalToFhir(vital));
  }

  private convertMedicationToFhir(medication: any): MedicationRequest {
    return {
      resourceType: "MedicationRequest",
      id: medication.id,
      status: this.mapMedicationStatus(medication.status),
      intent: "order",
      subject: {
        reference: `Patient/${medication.user_id}`,
      },
      authoredOn: medication.start_date,
      requester: medication.prescribed_by ? {
        reference: `Practitioner/${medication.prescribed_by.id}`,
        display: `${medication.prescribed_by.first_name} ${medication.prescribed_by.last_name}`,
      } : undefined,
      dosageInstruction: [{
        text: `${medication.dosage} ${medication.frequency}`,
      }],
      dispenseRequest: medication.pharmacy ? {
        performer: {
          reference: `Organization/${medication.pharmacy.id}`,
          display: medication.pharmacy.name,
        },
      } : undefined,
    };
  }

  private convertImmunizationToFhir(immunization: any): fhir4.Immunization {
    return {
      resourceType: "Immunization",
      id: immunization.id,
      status: "completed",
      vaccineCode: {
        text: immunization.name,
      },
      patient: {
        reference: `Patient/${immunization.user_id}`,
      },
  private convertAllergyToFhir(allergy: any): fhir4.AllergyIntolerance {
    return {
      resourceType: "AllergyIntolerance",
      id: allergy.id,
      clinicalStatus: {
        coding: [{
          system: "http://terminology.hl7.org/CodeSystem/allergyintolerance-clinical",
          code: "active",
          display: "Active",
        }],
      },
      verificationStatus: {
        coding: [{
          system: "http://terminology.hl7.org/CodeSystem/allergyintolerance-verification",
          code: "confirmed",
          display: "Confirmed",
        }],
      },
      type: "allergy",
      category: ["medication"],
      code: {
        text: allergy.name,
      },
      patient: {
        reference: `Patient/${allergy.user_id}`,
      },
      onsetDateTime: allergy.reaction_date,
      reaction: allergy.reaction ? [{
        manifestation: [{
          text: allergy.reaction,
        }],
        severity: this.mapAllergySeverity(allergy.severity),
      }] : undefined,
    };
  }

  private convertConditionToFhir(condition: any): fhir4.Condition {
    return {
      resourceType: "Condition",
      id: condition.id,
      clinicalStatus: {
        coding: [{
          system: "http://terminology.hl7.org/CodeSystem/condition-clinical",
          code: this.mapConditionStatus(condition.status),
          display: this.mapConditionStatusDisplay(condition.status),
        }],
      },
      verificationStatus: {
        coding: [{
          system: "http://terminology.hl7.org/CodeSystem/condition-ver-status",
          code: "confirmed",
          display: "Confirmed",
        }],
      },
      code: {
        text: condition.name,
      },
      subject: {
        reference: `Patient/${condition.user_id}`,
      },
      onsetDateTime: condition.diagnosis_date,
      recordedDate: condition.created_at,
      recorder: condition.diagnosed_by ? {
        reference: `Practitioner/${condition.diagnosed_by.id}`,
        display: `${condition.diagnosed_by.first_name} ${condition.diagnosed_by.last_name}`,
      } : undefined,
    };
  }

  private convertLabResultToFhir(labResult: any): fhir4.Observation {
    return {
      resourceType: "Observation",
      id: labResult.id,
      status: this.mapLabResultStatus(labResult.status),
      category: [{
        coding: [{
          system: "http://terminology.hl7.org/CodeSystem/observation-category",
          code: "laboratory",
          display: "Laboratory",
        }],
      }],
      code: {
        text: labResult.test_name,
      },
      subject: {
        reference: `Patient/${labResult.user_id}`,
      },
      effectiveDateTime: labResult.test_date,
      issued: labResult.report_date,
      valueQuantity: labResult.result_value ? {
        value: parseFloat(labResult.result_value),
        unit: labResult.unit,
      } : undefined,
      valueString: labResult.result_text,
      interpretation: labResult.interpretation ? [{
        coding: [{
          system: "http://terminology.hl7.org/CodeSystem/v3-ObservationInterpretation",
          code: this.mapLabInterpretation(labResult.interpretation),
          display: labResult.interpretation,
        }],
      }] : undefined,
      referenceRange: labResult.reference_range ? [{
        text: labResult.reference_range,
      }] : undefined,
      performer: labResult.ordered_by ? [{
        reference: `Practitioner/${labResult.ordered_by.id}`,
        display: `${labResult.ordered_by.first_name} ${labResult.ordered_by.last_name}`,
      }] : undefined,
    };
  }

  private convertVitalToFhir(vital: any): fhir4.Observation {
    return {
      resourceType: "Observation",
      id: vital.id,
      status: "final",
      category: [{
        coding: [{
          system: "http://terminology.hl7.org/CodeSystem/observation-category",
          code: "vital-signs",
          display: "Vital Signs",
        }],
      }],
      code: {
        text: vital.name,
      },
      subject: {
        reference: `Patient/${vital.user_id}`,
      },
      effectiveDateTime: vital.measurement_date,
      valueQuantity: {
        value: parseFloat(vital.value),
        unit: vital.unit,
      },
      performer: vital.measured_by ? [{
        reference: `Practitioner/${vital.measured_by.id}`,
        display: `${vital.measured_by.first_name} ${vital.measured_by.last_name}`,
      }] : undefined,
    };
  }

  private mapMedicationStatus(status: string): fhir4.MedicationRequestStatus {
    switch (status?.toLowerCase()) {
      case "active":
        return "active";
      case "discontinued":
        return "stopped";
      case "completed":
        return "completed";
      default:
        return "unknown";
    }
  }

  private mapAllergySeverity(severity: string): fhir4.AllergyIntoleranceReactionSeverity {
    switch (severity?.toLowerCase()) {
      case "mild":
        return "mild";
      case "moderate":
        return "moderate";
      case "severe":
        return "severe";
      default:
        return "mild";
    }
  }

  private mapConditionStatus(status: string): string {
    switch (status?.toLowerCase()) {
      case "active":
        return "active";
      case "inactive":
        return "inactive";
      case "resolved":
        return "resolved";
      default:
        return "active";
    }
  }

  private mapConditionStatusDisplay(status: string): string {
    switch (status?.toLowerCase()) {
      case "active":
        return "Active";
      case "inactive":
        return "Inactive";
      case "resolved":
        return "Resolved";
      default:
        return "Active";
    }
  }

  private mapLabResultStatus(status: string): fhir4.ObservationStatus {
    switch (status?.toLowerCase()) {
      case "final":
        return "final";
      case "preliminary":
        return "preliminary";
      case "amended":
        return "amended";
      default:
        return "final";
    }
  }

  private mapLabInterpretation(interpretation: string): string {
    switch (interpretation?.toLowerCase()) {
      case "high":
        return "H";
      case "low":
        return "L";
      case "normal":
        return "N";
      default:
        return "N";
    }
  }
  */
}

export default HealthieApi;

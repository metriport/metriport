import {
  AllergyIntolerance,
  Condition as ConditionFhir,
  Immunization as ImmunizationFhir,
  MedicationStatement,
  Observation,
  ResourceType,
} from "@medplum/fhirtypes";
import { MetriportError, NotFoundError, sleep, toTitleCase } from "@metriport/shared";
import { buildDayjs } from "@metriport/shared/common/date";
import { normalizeGenderSafe, unknownGender } from "@metriport/shared/domain/gender";
import {
  AllergiesGraphql,
  allergiesGraphqlSchema,
  Allergy,
  AppointmentGetResponseGraphql,
  appointmentGetResponseGraphqlSchema,
  AppointmentListResponseGraphql,
  appointmentListResponseGraphqlSchema,
  AppointmentWithAttendee,
  Condition,
  ConditionsGraphql,
  conditionsGraphqlSchema,
  Immunization,
  ImmunizationsGraphql,
  immunizationsGraphqlSchema,
  LabOrder,
  LabOrdersGraphql,
  labOrdersGraphqlSchema,
  Medication,
  MedicationsGraphql,
  medicationsGraphqlSchema,
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
  "Immunization",
  "AllergyIntolerance",
  "Condition",
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

  async getMedicationStatements({
    cxId,
    patientId,
  }: {
    cxId: string;
    patientId: string;
  }): Promise<MedicationStatement[]> {
    const { debug } = out(
      `Healthie getMedications - cxId ${cxId} practiceId ${this.practiceId} patientId ${patientId}`
    );
    const additionalInfo = { cxId, practiceId: this.practiceId, patientId };
    const operationName = "getMedications";
    const query = `query getMedications($patient_id: ID) {
      medications(patient_id: $patient_id) {
        id
        active
        code
        start_date
        end_date
        directions
        dosage
        frequency
        comment
      }
    }`;
    const variables = { patient_id: patientId };

    const medicationsGraphqlResponse = await this.makeRequest<MedicationsGraphql>({
      cxId,
      patientId: patientId.toString(),
      s3Path: "medications",
      operationName,
      query,
      variables,
      schema: medicationsGraphqlSchema,
      additionalInfo,
      debug,
    });
    return medicationsGraphqlResponse.data.medications.map(medication =>
      this.convertMedicationToFhir(patientId, medication)
    );
  }

  async getImmunizations({
    cxId,
    patientId,
  }: {
    cxId: string;
    patientId: string;
  }): Promise<ImmunizationFhir[]> {
    const { debug } = out(
      `Healthie getImmunizations - cxId ${cxId} practiceId ${this.practiceId} patientId ${patientId}`
    );
    const additionalInfo = { cxId, practiceId: this.practiceId, patientId };
    const operationName = "getImmunizations";
    const query = `query getImmunizations($userId: ID!) {
      user(id: $userId) {
        immunizations {
          id
          received_at
          status
          cvx_code
          vaccine_name
          additional_notes
        }
      }
    }`;
    const variables = { userId: patientId };

    const immunizationsGraphqlResponse = await this.makeRequest<ImmunizationsGraphql>({
      cxId,
      patientId: patientId.toString(),
      s3Path: "immunizations",
      operationName,
      query,
      variables,
      schema: immunizationsGraphqlSchema,
      additionalInfo,
      debug,
    });
    return immunizationsGraphqlResponse.data.user.immunizations.map(immunization =>
      this.convertImmunizationToFhir(patientId, immunization)
    );
  }

  async getAllergies({
    cxId,
    patientId,
  }: {
    cxId: string;
    patientId: string;
  }): Promise<AllergyIntolerance[]> {
    const { debug } = out(
      `Healthie getAllergies - cxId ${cxId} practiceId ${this.practiceId} patientId ${patientId}`
    );
    const additionalInfo = { cxId, practiceId: this.practiceId, patientId };
    const operationName = "getAllergies";
    const query = `query getAllergies($userId: ID!) {
      user(id: $userId) {
        id
        allergy_sensitivities {
          id
          category
          name
          onset_date
          reaction
          severity
          status
        }
      }
    }`;
    const variables = { userId: patientId };

    const allergiesGraphqlResponse = await this.makeRequest<AllergiesGraphql>({
      cxId,
      patientId: patientId.toString(),
      s3Path: "allergies",
      operationName,
      query,
      variables,
      schema: allergiesGraphqlSchema,
      additionalInfo,
      debug,
    });
    return allergiesGraphqlResponse.data.user.allergy_sensitivities.map(allergy =>
      this.convertAllergyToFhir(patientId, allergy)
    );
  }

  async getConditions({
    cxId,
    patientId,
  }: {
    cxId: string;
    patientId: string;
  }): Promise<ConditionFhir[]> {
    const { debug } = out(
      `Healthie getConditions - cxId ${cxId} practiceId ${this.practiceId} patientId ${patientId}`
    );
    const additionalInfo = { cxId, practiceId: this.practiceId, patientId };
    const operationName = "getConditions";
    const query = `query getConditions($userId: ID!) {
      user(id: $userId) {
        id
        diagnoses {
          id
          first_symptom_date
          end_date
          active
          icd_code {
            code
            display_name
          }
        }
      }
    }`;
    const variables = { userId: patientId };

    const conditionsGraphqlResponse = await this.makeRequest<ConditionsGraphql>({
      cxId,
      patientId: patientId.toString(),
      s3Path: "conditions",
      operationName,
      query,
      variables,
      schema: conditionsGraphqlSchema,
      additionalInfo,
      debug,
    });
    return conditionsGraphqlResponse.data.user.diagnoses.map(condition =>
      this.convertConditionToFhir(patientId, condition)
    );
  }

  async getLabObservations({
    cxId,
    patientId,
  }: {
    cxId: string;
    patientId: string;
  }): Promise<Observation[]> {
    const { debug } = out(
      `Healthie getLabResults - cxId ${cxId} practiceId ${this.practiceId} patientId ${patientId}`
    );
    const additionalInfo = { cxId, practiceId: this.practiceId, patientId };
    const operationName = "getLabResults";
    const query = `query getLabResults(
      $client_id: ID
      $status_filter: String
    ) {
      labOrders(
        client_id: $client_id
        status_filter: $status_filter
      ) {
        id
        status
        normalized_status
        test_date
        lab_results {
          id
          lab_observation_requests {
            id
            lab_analyte
            lab_observation_results {
              id
              interpretation
              units
              reference_range
              quantitative_result
              abnormal_flag
              is_abnormal
              notes
            }
          }
        }
      }
    }`;
    const variables = { userId: patientId };

    const labOrdersGraphqlResponse = await this.makeRequest<LabOrdersGraphql>({
      cxId,
      patientId: patientId.toString(),
      s3Path: "lab_results",
      operationName,
      query,
      variables,
      schema: labOrdersGraphqlSchema,
      additionalInfo,
      debug,
    });
    return labOrdersGraphqlResponse.data.labOrders.flatMap(labOrder => {
      const convertedLabOrder = this.convertLabOrderToFhir(patientId, labOrder);
      if (!convertedLabOrder) return [];
      return [convertedLabOrder];
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

  private convertMedicationToFhir(patientId: string, medication: Medication): MedicationStatement {
    const isCompleted = !medication.active && medication.end_date !== null;
    return {
      resourceType: "MedicationStatement",
      id: medication.id,
      subject: {
        reference: `Patient/${patientId}`,
      },
      status: medication.active ? "active" : isCompleted ? "completed" : "stopped",
      medicationCodeableConcept: {
        coding: [
          {
            system: "http://www.nlm.nih.gov/research/umls/rxnorm",
            code: medication.code,
          },
        ],
      },
      ...(medication.start_date && medication.end_date
        ? {
            effectivePeriod: {
              start: buildDayjs(medication.start_date).toISOString(),
              end: buildDayjs(medication.end_date).toISOString(),
            },
          }
        : medication.start_date
        ? {
            effectiveDateTime: buildDayjs(medication.start_date).toISOString(),
          }
        : medication.end_date
        ? {
            effectiveDateTime: buildDayjs(medication.end_date).toISOString(),
          }
        : {}),
      ...(medication.dosage
        ? {
            dosage: [
              {
                text: `${medication.dosage}${
                  medication.directions ? ` ${medication.directions}` : ""
                }${medication.frequency ? ` ${medication.frequency}` : ""}`,
              },
            ],
          }
        : {}),
      ...(medication.comment ? { note: [{ text: medication.comment }] } : {}),
    };
  }

  private convertImmunizationToFhir(
    patientId: string,
    immunization: Immunization
  ): ImmunizationFhir {
    const isCompleted = immunization.status === "completed";
    return {
      resourceType: "Immunization",
      id: immunization.id,
      patient: {
        reference: `Patient/${patientId}`,
      },
      status: isCompleted ? "completed" : "not-done",
      vaccineCode: {
        coding: [
          {
            system: "http://hl7.org/fhir/sid/cvx",
            code: immunization.cvx_code,
          },
        ],
      },
      occurrenceDateTime: buildDayjs(immunization.received_at).toISOString(),
      ...(immunization.additional_notes ? { note: [{ text: immunization.additional_notes }] } : {}),
    };
  }

  private convertAllergyToFhir(patientId: string, allergy: Allergy): AllergyIntolerance {
    const allergyCategory = allergy.category_type
      ? this.mapAllergyCategory(allergy.category_type)
      : undefined;
    return {
      resourceType: "AllergyIntolerance",
      id: allergy.id,
      patient: {
        reference: `Patient/${patientId}`,
      },
      clinicalStatus: {
        coding: [
          {
            system: "http://terminology.hl7.org/CodeSystem/allergyintolerance-clinical",
            code: allergy.status,
          },
        ],
      },
      code: { text: allergy.name },
      onsetDateTime: buildDayjs(allergy.onset_date).toISOString(),
      type: allergy.category === "allergy" ? "allergy" : "intolerance",
      ...(allergyCategory && allergyCategory !== "other" ? { category: [allergyCategory] } : {}),
      reaction: [
        {
          manifestation: [{ text: allergy.reaction }],
          ...(allergy.severity !== "unknown" ? { severity: allergy.severity } : {}),
        },
      ],
    };
  }

  private convertConditionToFhir(patientId: string, condition: Condition): ConditionFhir {
    return {
      resourceType: "Condition",
      id: condition.id,
      subject: {
        reference: `Patient/${patientId}`,
      },
      clinicalStatus: {
        coding: [
          {
            system: "http://terminology.hl7.org/CodeSystem/condition-clinical",
            code: condition.active ? "active" : "inactive",
          },
        ],
      },
      code: {
        coding: [
          {
            system: condition.icd_code.system,
            code: condition.icd_code.code,
          },
        ],
      },
      ...(condition.first_symptom_date && condition.end_date
        ? {
            effectivePeriod: {
              start: buildDayjs(condition.first_symptom_date).toISOString(),
              end: buildDayjs(condition.end_date).toISOString(),
            },
          }
        : condition.first_symptom_date
        ? {
            effectiveDateTime: buildDayjs(condition.first_symptom_date).toISOString(),
          }
        : condition.end_date
        ? {
            effectiveDateTime: buildDayjs(condition.end_date).toISOString(),
          }
        : {}),
    };
  }

  private convertLabOrderToFhir(patientId: string, labOrder: LabOrder): Observation | undefined {
    const isFinal = labOrder.normalized_status === "final";
    const labResult = labOrder.lab_results[0];
    if (!labResult) return undefined;
    const labObservationRequest = labResult.lab_observation_requests[0];
    if (!labObservationRequest) return undefined;
    const labObservationResult = labObservationRequest.lab_observation_results[0];
    if (!labObservationResult) return undefined;
    const quantitativeResult = labObservationResult.quantitative_result;
    const units = labObservationResult.units;
    return {
      resourceType: "Observation",
      id: labOrder.id,
      subject: {
        reference: `Patient/${patientId}`,
      },
      status: isFinal ? "final" : "registered",
      category: [
        {
          coding: [
            {
              system: "http://terminology.hl7.org/CodeSystem/observation-category",
              code: "laboratory",
              display: "Laboratory",
            },
          ],
        },
      ],
      code: { text: labObservationRequest.lab_analyte },
      effectiveDateTime: buildDayjs(labOrder.test_date).toISOString(),
      valueQuantity: { value: parseFloat(quantitativeResult), unit: units },
      referenceRange: [{ text: labObservationResult.reference_range }],
      interpretation: [{ text: toTitleCase(labObservationResult.interpretation) }],
      ...(labObservationResult.notes ? { note: [{ text: labObservationResult.notes }] } : {}),
    };
  }

  private mapAllergyCategory(category: string): "medication" | "food" | "environment" | "other" {
    switch (category.toLowerCase()) {
      case "drug":
        return "medication";
      case "food":
        return "food";
      case "environmental":
        return "environment";
      default:
        return "other";
    }
  }
}

export default HealthieApi;

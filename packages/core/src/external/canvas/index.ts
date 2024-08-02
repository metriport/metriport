import axios, { AxiosInstance, AxiosResponse, AxiosError } from "axios";
import {
  Patient,
  Practitioner,
  Condition,
  MedicationStatement,
  AllergyIntolerance,
  Location,
  Encounter,
  Medication,
  Bundle,
  Appointment,
} from "@medplum/fhirtypes";

const RXNORM_SYSTEM = "http://www.nlm.nih.gov/research/umls/rxnorm";

type SDKConfig = {
  environment: string;
  clientId: string;
  clientSecret: string;
};

export type CommandResponse = {
  uuid: string;
  state: string;
  created_at: string;
  updated_at: string;
  schema_key: string;
  patient_key: string;
  note_key: string;
  originated_by: string;
  edited_by: string[];
  committed_by: string | null;
  entered_in_error_by: string | null;
  data: Record<string, unknown>;
};

class CanvasSDK {
  private axiosInstanceFhirApi: AxiosInstance;
  private axiosInstanceCustomApi: AxiosInstance;
  private OAuthToken: string;

  private constructor(private config: SDKConfig) {
    this.OAuthToken = "";
    this.axiosInstanceFhirApi = axios.create({});
    this.axiosInstanceCustomApi = axios.create({});
  }

  public static async create(config: SDKConfig): Promise<CanvasSDK> {
    const instance = new CanvasSDK(config);
    await instance.initialize();
    return instance;
  }

  private async fetchOAuthToken(): Promise<void> {
    const url = `https://${this.config.environment}.canvasmedical.com/auth/token/`;
    const payload = `grant_type=client_credentials&client_id=${this.config.clientId}&client_secret=${this.config.clientSecret}`;

    try {
      const response = await axios.post(url, payload, {
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
      });

      this.OAuthToken = response.data.access_token;
    } catch (error) {
      throw new Error("Failed to fetch OAuth token");
    }
  }

  async initialize(): Promise<void> {
    await this.fetchOAuthToken();

    this.axiosInstanceFhirApi = axios.create({
      baseURL: `https://fumage-${this.config.environment}.canvasmedical.com/`,
      headers: {
        accept: "application/json",
        Authorization: `Bearer ${this.OAuthToken}`,
        "content-type": "application/json",
      },
    });

    this.axiosInstanceCustomApi = axios.create({
      baseURL: `https://${this.config.environment}.canvasmedical.com/core/api`,
      headers: {
        Authorization: `Bearer ${this.OAuthToken}`,
        "content-type": "application/json",
      },
    });
  }

  private async handleAxiosRequest<T>(
    requestFunction: () => Promise<AxiosResponse<T>>
  ): Promise<AxiosResponse<T>> {
    try {
      const response = await requestFunction();
      return response;
    } catch (error) {
      if (axios.isAxiosError(error)) {
        const axiosError = error as AxiosError;
        const statusCode = axiosError.response?.status;
        const errorMessage = axiosError.response?.data;
        const msg = `Request failed. Status: ${statusCode}. Message: ${JSON.stringify(
          errorMessage
        )}`;
        console.log("error", JSON.stringify(error, null, 2));
        throw new Error(msg);
      }
      throw new Error("An unexpected error occurred during the request");
    }
  }

  async getPractitioner(name: string): Promise<Practitioner> {
    const response = await this.handleAxiosRequest(() =>
      this.axiosInstanceFhirApi.get(
        `Practitioner?name=${name}&include-non-scheduleable-practitioners=true`
      )
    );
    return response.data.entry[0].resource;
  }

  async createPatient(patient: Patient): Promise<string> {
    const response = await this.handleAxiosRequest(() =>
      this.axiosInstanceFhirApi.post("Patient", patient)
    );

    const locationHeader = response.headers["location"];
    const patientId = locationHeader?.split("/").pop() ?? "";
    return patientId;
  }

  async getLocation(): Promise<Location> {
    const response = await this.handleAxiosRequest(() => this.axiosInstanceFhirApi.get(`Location`));
    return response.data.entry[0].resource;
  }

  async createNote({
    patientKey,
    providerKey,
    practiceLocationKey,
    noteTypeName,
  }: {
    patientKey: string;
    providerKey: string;
    practiceLocationKey: string;
    noteTypeName: string;
  }) {
    const payload = {
      title: "Metriport Chart Import",
      noteTypeName,
      patientKey,
      providerKey,
      practiceLocationKey,
      encounterStartTime: new Date().toISOString(),
    };

    const response = await this.handleAxiosRequest(() =>
      this.axiosInstanceCustomApi.post("notes/v1/Note", payload)
    );
    return response.data.noteKey;
  }

  async updateNoteTitle({ noteKey, title }: { noteKey: string; title: string }): Promise<void> {
    const payload = {
      title,
    };

    await this.handleAxiosRequest(() =>
      this.axiosInstanceCustomApi.patch(`notes/v1/Note/${noteKey}`, payload)
    );
  }

  async createCondition({
    condition,
    patientId,
    practitionerId,
    noteId,
  }: {
    condition: Condition;
    patientId: string;
    practitionerId: string;
    noteId: string;
  }): Promise<string> {
    condition.subject = { reference: `Patient/${patientId}` };
    condition.recorder = { reference: `Practitioner/${practitionerId}` };
    condition.extension = [
      {
        url: "http://schemas.canvasmedical.com/fhir/extensions/note-id",
        valueId: noteId,
      },
    ];
    const response = await this.handleAxiosRequest(() =>
      this.axiosInstanceFhirApi.post("Condition", condition)
    );
    return response.headers["location"]?.split("/").pop() ?? "";
  }

  async createMedicationStatement({
    medication,
    patientId,
    noteId,
  }: {
    medication: MedicationStatement;
    patientId: string;
    noteId: string;
  }): Promise<string> {
    medication.subject = { reference: `Patient/${patientId}` };
    medication.extension = [
      {
        url: "http://schemas.canvasmedical.com/fhir/extensions/note-id",
        valueId: noteId,
      },
    ];
    const response = await this.handleAxiosRequest(() =>
      this.axiosInstanceFhirApi.post("MedicationStatement", medication)
    );
    return response.headers["location"]?.split("/").pop() ?? "";
  }

  async createAllergy({
    allergy,
    patientId,
    noteId,
    practitionerId,
  }: {
    allergy: AllergyIntolerance;
    patientId: string;
    noteId: string;
    practitionerId: string;
  }): Promise<string> {
    if (!patientId || !noteId || !practitionerId) {
      throw new Error(
        "Patient ID, Note ID, and Practitioner ID must be set before adding an allergy"
      );
    }
    allergy.patient = { reference: `Patient/${patientId}` };
    allergy.recorder = { reference: `Practitioner/${practitionerId}` };
    allergy.extension = [
      {
        url: "http://schemas.canvasmedical.com/fhir/extensions/note-id",
        valueId: noteId,
      },
    ];
    const response = await this.handleAxiosRequest(() =>
      this.axiosInstanceFhirApi.post("AllergyIntolerance", allergy)
    );
    return response.headers["location"]?.split("/").pop() ?? "";
  }

  async getFirstEncounter(patientId: string): Promise<Encounter> {
    const response = await this.handleAxiosRequest(() =>
      this.axiosInstanceFhirApi.get(`Encounter?patient=${patientId}&_sort=-date&_count=1`)
    );
    return response.data.entry[0].resource;
  }

  async getMedication(medicationId: string): Promise<Medication> {
    const response = await this.handleAxiosRequest(() =>
      this.axiosInstanceFhirApi.get(`Medication/${medicationId}`)
    );
    return response.data;
  }

  async searchMedication({
    rxNormCode,
    medicationName,
  }: {
    rxNormCode?: string;
    medicationName?: string;
  }): Promise<Bundle> {
    if (!rxNormCode && !medicationName) {
      throw new Error("At least one of rxNormCode or medicationName must be provided");
    }

    let url = "Medication?";
    const params: string[] = [];

    if (rxNormCode) {
      params.push(`code=${RXNORM_SYSTEM}|${rxNormCode}`);
    }

    if (medicationName) {
      params.push(`_text=${encodeURIComponent(medicationName)}`);
    }

    url += params.join("&");

    const response = await this.handleAxiosRequest(() => this.axiosInstanceFhirApi.get(url));
    if (response.data.entry && response.data.entry.length > 0) {
      return response.data.entry;
    }
    throw new Error("Medication not found");
  }

  async getAppointment(appointmentId: string): Promise<Appointment> {
    const response = await this.handleAxiosRequest(() =>
      this.axiosInstanceFhirApi.get(`Appointment/${appointmentId}`)
    );
    return response.data;
  }

  async getCommands(options?: {
    patient_key?: string;
    note_key?: string;
    originator_key?: string;
    committer_key?: string;
    schema_key?: string;
    state?: string;
    created_at?: string;
    created_at__lt?: string;
    created_at__lte?: string;
    created_at__gt?: string;
    created_at__gte?: string;
    updated_at?: string;
    updated_at__lt?: string;
    updated_at__lte?: string;
    updated_at__gt?: string;
    updated_at__gte?: string;
  }): Promise<CommandResponse[]> {
    const params = new URLSearchParams();

    if (options) {
      Object.entries(options).forEach(([key, value]) => {
        if (value !== undefined) {
          params.append(key, value);
        }
      });
    }

    const response = await this.handleAxiosRequest(() =>
      this.axiosInstanceCustomApi.get(`v1/commands?${params.toString()}`)
    );

    return response.data;
  }

  async getCommandFields(commandUuid: string): Promise<CommandResponse> {
    const response = await this.handleAxiosRequest(() =>
      this.axiosInstanceCustomApi.get(`v1/commands/${commandUuid}/fields`)
    );

    return response.data;
  }

  async getCommand(commandUuid: string): Promise<CommandResponse> {
    const response = await this.handleAxiosRequest(() =>
      this.axiosInstanceCustomApi.get(`v1/commands/${commandUuid}`)
    );

    return response.data;
  }

  async createCommand(params: {
    schemaKey: string;
    noteKey: string;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    values?: Record<string, any>;
  }): Promise<CommandResponse> {
    const payload = {
      schemaKey: params.schemaKey,
      noteKey: params.noteKey,
      values: params.values || {},
    };

    const response = await this.handleAxiosRequest(() =>
      this.axiosInstanceCustomApi.post("v1/commands/", payload)
    );

    return response.data;
  }

  async createAllergyCommand({
    noteId,
    allergy,
  }: {
    noteId: string;
    allergy: AllergyIntolerance;
  }): Promise<CommandResponse> {
    const values = {
      allergy: {
        text: allergy?.code?.text,
        extra: {
          coding: allergy?.code?.coding,
        },
      },
      severity: allergy?.reaction?.[0]?.severity,
      narrative: allergy?.note?.[0]?.text,
      approximate_date: {
        date: allergy.onsetDateTime,
        input: allergy.onsetDateTime,
      },
    };
    return this.createCommand({
      noteKey: noteId,
      schemaKey: "allergy",
      values,
    });
  }

  async createMedicationStatementCommand({
    noteId,
    medication,
  }: {
    noteId: string;
    medication: MedicationStatement;
  }): Promise<CommandResponse> {
    const code = medication.medicationReference?.reference?.match(/\d+/)?.[0];
    const values = {
      medication: {
        text: medication.medicationReference?.display,
        value: code,
        extra: {
          coding: [
            {
              code,
              display: medication.medicationReference?.display,
              system: "http://www.fdbhealth.com/",
            },
          ],
        },
      },
      sig: medication.dosage?.[0]?.text,
    };
    return this.createCommand({
      noteKey: noteId,
      schemaKey: "medicationStatement",
      values,
    });
  }

  async createConditionCommand({
    noteId,
    condition,
  }: {
    noteId: string;
    condition: Condition;
  }): Promise<CommandResponse> {
    const code = condition.code?.coding?.[0]?.code;
    console.log("condition.onsetDateTime", condition.onsetDateTime);
    const values = {
      diagnose: {
        text: condition.code?.text,
        extra: {
          coding: condition.code?.coding,
        },
        value: code,
      },
      background: "",
      today_assessment: "",
      approximate_date_of_onset: {
        date: condition.onsetDateTime,
        input: condition.onsetDateTime,
      },
    };
    return this.createCommand({
      noteKey: noteId,
      schemaKey: "diagnose",
      values,
    });
  }
}

export default CanvasSDK;

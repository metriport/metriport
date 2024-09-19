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

interface SDKConfig {
  environment: string;
  clientId: string;
  clientSecret: string;
  OAuthToken?: string;
}

class CanvasSDK {
  private axiosInstanceFhirApi: AxiosInstance;
  private axiosInstanceApi: AxiosInstance;
  private axiosInstanceCoreApi: AxiosInstance;
  private OAuthToken: string;

  private constructor(private config: SDKConfig) {
    this.OAuthToken = config.OAuthToken ?? "";
    this.axiosInstanceFhirApi = axios.create({});
    this.axiosInstanceApi = axios.create({});
    this.axiosInstanceCoreApi = axios.create({});
  }

  public static async create(config: SDKConfig): Promise<CanvasSDK> {
    const instance = new CanvasSDK(config);
    await instance.initialize();
    return instance;
  }

  private async fetchOAuthToken(): Promise<void> {
    const url = `http://home-app-web:8000/auth/token/`;
    const payload = `grant_type=client_credentials&client_id=${this.config.clientId}&client_secret=${this.config.clientSecret}`;

    try {
      const response = await axios.post(url, payload, {
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
      });

      this.OAuthToken = response.data.access_token;
    } catch (error) {
      console.log(error);
      throw new Error("Failed to fetch OAuth token");
    }
  }

  async initialize(): Promise<void> {
    if (!this.OAuthToken) {
      await this.fetchOAuthToken();
    }

    this.axiosInstanceFhirApi = axios.create({
      baseURL: `https://home-app-web:8000/`,
      headers: {
        Accept: "application/json",
        Authorization: `Bearer ${this.OAuthToken}`,
        "Content-Type": "application/json",
      },
    });

    this.axiosInstanceApi = axios.create({
      baseURL: `http://home-app-web:8000/api/`,
      headers: {
        Accept: "application/json",
        Authorization: `Bearer ${this.OAuthToken}`,
        "Content-Type": "application/json",
      },
    });

    this.axiosInstanceCoreApi = axios.create({
      baseURL: `http://home-app-web:8000/core/api/`,
      headers: {
        Authorization: `Bearer ${this.OAuthToken}`,
        "Content-Type": "application/json",
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
    returnKey,
  }: {
    patientKey: string;
    providerKey: string;
    practiceLocationKey: string;
    noteTypeName: string;
    returnKey: "id" | "noteKey";
  }): Promise<string> {
    const payload = {
      title: "Metriport Chart Import",
      noteTypeName,
      patientKey,
      providerKey,
      practiceLocationKey,
      encounterStartTime: new Date().toISOString(),
    };

    const response = await this.handleAxiosRequest(() =>
      this.axiosInstanceCoreApi.post("notes/v1/Note", payload)
    );
    return response.data[returnKey];
  }

  async getNote({ noteId }: { noteId: string }): Promise<object> {
    const response = await this.handleAxiosRequest(() =>
      this.axiosInstanceApi.get(`Note/${noteId}`)
    );
    return response.data;
  }

  async updateNote({ noteId, note }: { noteId: string; note: object }): Promise<object> {
    const response = await this.handleAxiosRequest(() =>
      this.axiosInstanceApi.patch(`Note/${noteId}`, note)
    );
    return response.data;
  }

  async createNoteMedicationStatement({
    patientId,
    noteId,
  }: {
    patientId: string;
    noteId: string;
  }): Promise<object> {
    const response = await this.handleAxiosRequest(() =>
      this.axiosInstanceApi.post("MedicationStatement/", {
        patient: patientId,
        note: noteId,
      })
    );
    return response.data;
  }

  async updateNoteMedicationStatement({
    medicationStatementId,
    medicationStatement,
  }: {
    medicationStatementId: string;
    medicationStatement: object;
  }): Promise<object> {
    const response = await this.handleAxiosRequest(() =>
      this.axiosInstanceApi.patch(
        `MedicationStatement/${medicationStatementId}`,
        medicationStatement
      )
    );
    return response.data;
  }

  async updateNoteTitle({ noteKey, title }: { noteKey: string; title: string }): Promise<void> {
    const payload = {
      title,
    };

    await this.handleAxiosRequest(() =>
      this.axiosInstanceCoreApi.patch(`notes/v1/Note/${noteKey}`, payload)
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
      this.axiosInstanceFhirApi.post(`Condition/`, condition)
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
}

export default CanvasSDK;

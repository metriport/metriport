import axios, { AxiosInstance, AxiosResponse, AxiosError } from "axios";
import {
  Patient,
  Practitioner,
  Appointment,
  Encounter,
  Condition,
  MedicationStatement,
  AllergyIntolerance,
} from "@medplum/fhirtypes";

interface SDKConfig {
  environment: string;
  token: string;
}

class CanvasSDK {
  private axiosInstance: AxiosInstance;
  public practitionerId?: string;
  public patientId?: string;
  public encounterId?: string;

  constructor(config: SDKConfig) {
    this.axiosInstance = axios.create({
      baseURL: `https://fumage-${config.environment}.canvasmedical.com/`,
      headers: {
        accept: "application/json",
        Authorization: `Bearer ${config.token}`,
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
        console.log("msg", msg);
        throw new Error(msg);
      }
      throw new Error("An unexpected error occurred during the request");
    }
  }

  async getPractitioner(name: string): Promise<Practitioner> {
    return this.handleAxiosRequest(() =>
      this.axiosInstance.get(
        `Practitioner?name=${name}&include-non-scheduleable-practitioners=true`
      )
    ).then(data => data.data.entry[0].resource);
  }

  setPractitionerId(id: string | undefined): string {
    if (!id) throw new Error("Undefined Practitioner Id");
    this.practitionerId = id;
    return this.practitionerId;
  }

  async createPatient(patient: Patient): Promise<string> {
    const response = await this.handleAxiosRequest(() =>
      this.axiosInstance.post("Patient", patient)
    );

    const locationHeader = response.headers["location"];
    const patientId = locationHeader?.split("/").pop() ?? "";
    this.setPatientId(patientId);
    return patientId;
  }

  setPatientId(id: string | undefined): string {
    if (!id) throw new Error("Invalid Patient Id: id is undefined");
    this.patientId = id;
    return this.patientId;
  }

  async createAppointment(appointment: Appointment): Promise<string> {
    if (!this.patientId || !this.practitionerId) {
      throw new Error("Patient ID and Practitioner ID must be set before creating an appointment");
    }
    appointment.participant = [
      { actor: { reference: `Patient/${this.patientId}` }, status: "accepted" },
      { actor: { reference: `Practitioner/${this.practitionerId}` }, status: "accepted" },
    ];
    const response = await this.handleAxiosRequest(() =>
      this.axiosInstance.post("Appointment", appointment)
    );
    return response.headers["location"]?.split("/").pop() ?? "";
  }

  async getEncounter(): Promise<Encounter> {
    if (!this.patientId) {
      throw new Error("Patient ID must be set before getting an encounter");
    }
    const response = await this.handleAxiosRequest(() =>
      this.axiosInstance.get(`Encounter?patient=Patient/${this.patientId}`)
    );
    const encounter = response.data.entry[0].resource;
    this.setEncounterId(encounter.id ?? "");
    return encounter;
  }

  setEncounterId(id: string | undefined): string {
    if (!id) throw new Error("Undefined Encounter Id");
    this.encounterId = id;
    return this.encounterId;
  }

  async createCondition(condition: Condition): Promise<string> {
    if (!this.patientId || !this.encounterId || !this.practitionerId) {
      throw new Error(
        "Patient ID, Encounter ID, and Practitioner ID must be set before adding a condition"
      );
    }
    condition.subject = { reference: `Patient/${this.patientId}` };
    condition.encounter = { reference: `Encounter/${this.encounterId}` };
    condition.recorder = { reference: `Practitioner/${this.practitionerId}` };
    const response = await this.handleAxiosRequest(() =>
      this.axiosInstance.post("Condition", condition)
    );
    return response.headers["location"]?.split("/").pop() ?? "";
  }

  async createMedication(medication: MedicationStatement): Promise<string> {
    if (!this.patientId || !this.encounterId) {
      throw new Error("Patient ID and Encounter ID must be set before adding a medication");
    }
    medication.subject = { reference: `Patient/${this.patientId}` };
    medication.context = { reference: `Encounter/${this.encounterId}` };
    const response = await this.handleAxiosRequest(() =>
      this.axiosInstance.post("MedicationStatement", medication)
    );
    return response.headers["location"]?.split("/").pop() ?? "";
  }

  async createAllergy(allergy: AllergyIntolerance): Promise<string> {
    if (!this.patientId || !this.encounterId || !this.practitionerId) {
      throw new Error(
        "Patient ID, Encounter ID, and Practitioner ID must be set before adding an allergy"
      );
    }
    allergy.patient = { reference: `Patient/${this.patientId}` };
    allergy.encounter = { reference: `Encounter/${this.encounterId}` };
    allergy.recorder = { reference: `Practitioner/${this.practitionerId}` };
    const response = await this.handleAxiosRequest(() =>
      this.axiosInstance.post("AllergyIntolerance", allergy)
    );
    return response.headers["location"]?.split("/").pop() ?? "";
  }
}

export default CanvasSDK;

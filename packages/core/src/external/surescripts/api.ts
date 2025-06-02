import axios, { AxiosInstance } from "axios";
import { MetriportError } from "@metriport/shared";
import { Patient } from "@metriport/shared/domain/patient";
import { CustomerData, FacilityData } from "@metriport/shared/domain/facility";
import { Config } from "../../util/config";
import { getPatient } from "./api/get-patient";
import { getPatientIds } from "./api/get-patient-ids";
import { getCustomer } from "./api/get-customer";
import { executeAsynchronously } from "../../util/concurrency";

export class SurescriptsApi {
  axiosInstance: AxiosInstance;

  constructor() {
    this.axiosInstance = axios.create({
      baseURL: Config.getApiUrl(),
    });
  }

  async getCustomer(cxId: string): Promise<CustomerData> {
    return getCustomer({ cxId }, this.axiosInstance);
  }

  async getFacility(cxId: string, facilityId: string): Promise<FacilityData> {
    const customer = await this.getCustomer(cxId);
    const facility = customer.facilities.find(f => f.id === facilityId);
    if (!facility) {
      throw new MetriportError("Facility not found", undefined, { cxId, facilityId });
    }
    return facility;
  }

  async getPatientIds(cxId: string, facilityId?: string | undefined): Promise<string[]> {
    const { patientIds } = await getPatientIds({ cxId, facilityId }, this.axiosInstance);
    return patientIds;
  }

  async getEachPatientById(cxId: string, patientIds: string[]): Promise<Patient[]> {
    const patients: Patient[] = [];
    await executeAsynchronously(patientIds, async patientId => {
      const patient = await this.getPatient(cxId, patientId);
      patients.push(patient);
    });
    return patients;
  }

  async getPatient(cxId: string, patientId: string): Promise<Patient> {
    return getPatient(
      {
        cxId,
        patientId,
      },
      this.axiosInstance
    );
  }
}

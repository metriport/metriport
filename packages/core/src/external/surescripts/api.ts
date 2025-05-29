import axios, { AxiosInstance } from "axios";
import { Patient } from "@metriport/shared/domain/patient";
import { CustomerData } from "@metriport/shared/domain/facility";
import { Config } from "../../util/config";
import { getPatient } from "./api/get-patient";
import { getPatientIds } from "./api/get-patient-ids";
import { getCustomer } from "./api/get-customer";

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

  async getPatientIds(cxId: string, facilityId?: string | undefined): Promise<string[]> {
    const { patientIds } = await getPatientIds({ cxId, facilityId }, this.axiosInstance);
    return patientIds;
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

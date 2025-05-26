import axios, { AxiosInstance } from "axios";
import { getPatient, GetPatientResponse } from "../api/get-patient";
import { getPatientIds, GetPatientIdsResponse } from "../api/get-patient-ids";
import { Config } from "../../../util/config";
import { getCustomer, GetCustomerResponse } from "../api/get-customer";

export class SurescriptsApi {
  axiosInstance: AxiosInstance;

  constructor() {
    this.axiosInstance = axios.create({
      baseURL: Config.getApiUrl(),
    });
  }

  async getCustomer(cxId: string): Promise<GetCustomerResponse> {
    return getCustomer({ cxId }, this.axiosInstance);
  }

  async getPatientIds(
    cxId: string,
    facilityId?: string | undefined
  ): Promise<GetPatientIdsResponse> {
    return getPatientIds({ cxId, facilityId }, this.axiosInstance);
  }

  async getPatient(cxId: string, patientId: string): Promise<GetPatientResponse> {
    return getPatient(
      {
        cxId,
        patientId,
      },
      this.axiosInstance
    );
  }
}

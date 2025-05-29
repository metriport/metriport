import axios, { AxiosInstance } from "axios";
import { getPatient } from "./api/get-patient";
import { getPatientIds } from "./api/get-patient-ids";
import { Config } from "../../util/config";
import { getCustomer } from "./api/get-customer";
import { GetPatientResponse, GetPatientIdsResponse, GetCustomerResponse } from "./api/shared";

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

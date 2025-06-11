import axios, { AxiosInstance } from "axios";
import { MetriportError } from "@metriport/shared";
import { Patient } from "@metriport/shared/domain/patient";
import { SurescriptsRequestData, SurescriptsRequestEvent } from "./types";
import { CustomerData, FacilityData } from "@metriport/shared/domain/customer";
import { Config } from "../../util/config";
import { getPatient } from "./api/get-patient";
import { getPatientIds } from "./api/get-patient-ids";
import { getCustomerData } from "./api/get-customer";
import { executeAsynchronously } from "../../util/concurrency";

export class SurescriptsApi {
  axiosInstance: AxiosInstance;

  constructor() {
    this.axiosInstance = axios.create({
      baseURL: Config.getApiUrl(),
    });
  }

  async getRequestData({
    cxId,
    facilityId,
    patientId,
  }: SurescriptsRequestEvent): Promise<SurescriptsRequestData> {
    const customer = await this.getCustomerData(cxId);
    const facility = customer.facilities.find(f => f.id === facilityId);
    if (!facility) {
      throw new MetriportError("Facility not found", undefined, { cxId, facilityId });
    }

    const facilityPatientIds = await this.getPatientIds(cxId, facilityId);
    if (patientId) {
      const patientIdSet = new Set(patientId);
      const filteredPatientIds = facilityPatientIds.filter(id => patientIdSet.has(id));
      const patients = await this.getEachPatientById(cxId, filteredPatientIds);
      return { cxId, facility, patients };
    } else {
      const patients = await this.getEachPatientById(cxId, facilityPatientIds);
      return { cxId, facility, patients };
    }
  }

  async getCustomerData(cxId: string): Promise<CustomerData> {
    return getCustomerData({ cxId }, this.axiosInstance);
  }

  async getFacilityData(cxId: string, facilityId: string): Promise<FacilityData> {
    const customer = await this.getCustomerData(cxId);
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
    await executeAsynchronously(
      patientIds,
      async patientId => {
        const patient = await this.getPatient(cxId, patientId);
        patients.push(patient);
      },
      {
        numberOfParallelExecutions: 10,
      }
    );
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

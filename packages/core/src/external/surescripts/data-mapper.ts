import { NotFoundError } from "@metriport/shared";
import { CustomerData, FacilityData } from "@metriport/shared/domain/customer";
import { Patient } from "@metriport/shared/domain/patient";
import axios, { AxiosInstance } from "axios";
import { executeAsynchronously } from "../../util/concurrency";
import { Config } from "../../util/config";
import { getCustomerData } from "./api/get-customer";
import { getPatient } from "./api/get-patient";
import { getPatientIdsForFacility } from "./api/get-patient-ids-for-facility";
import { recreateConsolidatedBundle } from "./api/recreate-consolidated";
import {
  SurescriptsBatchRequest,
  SurescriptsBatchRequestData,
  SurescriptsPatientRequest,
  SurescriptsPatientRequestData,
  SurescriptsRequester,
} from "./types";

export class SurescriptsDataMapper {
  axiosInstance: AxiosInstance;

  constructor() {
    this.axiosInstance = axios.create({
      baseURL: Config.getApiUrl(),
    });
  }

  async getPatientRequestData({
    cxId,
    facilityId,
    patientId,
  }: SurescriptsPatientRequest): Promise<SurescriptsPatientRequestData> {
    const facility = await this.getFacilityData(cxId, facilityId);
    const patient = await this.getPatient(cxId, patientId);
    return { cxId, facility, patient };
  }

  async getBatchRequestData({
    cxId,
    facilityId,
    patientIds,
  }: SurescriptsBatchRequest): Promise<SurescriptsBatchRequestData> {
    const facility = await this.getFacilityData(cxId, facilityId);
    const validPatientIds = await this.validatePatientIdsForFacility(cxId, facilityId, patientIds);
    const patients = await this.getEachPatientById(cxId, validPatientIds);
    return { cxId, facility, patients };
  }

  convertBatchRequestToPatientRequests(
    batchRequestData: SurescriptsBatchRequestData
  ): SurescriptsPatientRequestData[] {
    return batchRequestData.patients.map(patient => ({
      cxId: batchRequestData.cxId,
      facility: batchRequestData.facility,
      patient,
    }));
  }

  async getFacilityData(cxId: string, facilityId: string): Promise<FacilityData> {
    const customer = await this.getCustomerData(cxId);
    const facility = customer.facilities.find(f => f.id === facilityId);
    if (!facility) throw new NotFoundError("Facility not found", undefined, { cxId, facilityId });
    return facility;
  }

  async validatePatientIdsForFacility(
    cxId: string,
    facilityId: string,
    patientIds: string[]
  ): Promise<string[]> {
    const validPatientIds = await this.getPatientIdsForFacility({ cxId, facilityId });
    const requestedPatientIds = new Set(patientIds);
    return validPatientIds.filter(id => requestedPatientIds.has(id));
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

  async recreateConsolidatedBundle(
    cxId: string,
    patientId: string
  ): Promise<{ requestId: string }> {
    return recreateConsolidatedBundle({ cxId, patientId }, this.axiosInstance);
  }

  async getCustomerData(cxId: string): Promise<CustomerData> {
    return getCustomerData({ cxId }, this.axiosInstance);
  }

  async getPatientIdsForFacility({ cxId, facilityId }: SurescriptsRequester): Promise<string[]> {
    return getPatientIdsForFacility({ cxId, facilityId }, this.axiosInstance);
  }

  async getPatient(cxId: string, patientId: string): Promise<Patient> {
    return getPatient({ cxId, patientId }, this.axiosInstance);
  }
}

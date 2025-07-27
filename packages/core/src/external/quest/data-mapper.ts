import { NotFoundError } from "@metriport/shared";
import { CustomerData, FacilityData } from "@metriport/shared/domain/customer";
import { Patient } from "@metriport/shared/domain/patient";
import axios, { AxiosInstance } from "axios";
import { executeAsynchronously } from "../../util/concurrency";
import { Config } from "../../util/config";
import { getCustomerData } from "./api/get-customer";
import { getPatient } from "./api/get-patient";
import { getPatientIdsForFacility } from "./api/get-patient-ids-for-facility";
import {
  QuestBatchRequest,
  QuestBatchRequestData,
  QuestPatientRequest,
  QuestPatientRequestData,
  QuestRequester,
} from "./types";

export class QuestDataMapper {
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
  }: QuestPatientRequest): Promise<QuestPatientRequestData> {
    const facility = await this.getFacilityData(cxId, facilityId);
    const patient = await this.getPatient(cxId, patientId);
    return { cxId, facility, patient };
  }

  async getBatchRequestData({
    cxId,
    facilityId,
    patientIds,
  }: QuestBatchRequest): Promise<QuestBatchRequestData> {
    const facility = await this.getFacilityData(cxId, facilityId);
    const validPatientIds = await this.validatePatientIdsForFacility(cxId, facilityId, patientIds);
    const patients = await this.getEachPatientById(cxId, validPatientIds);
    return { cxId, facility, patients };
  }

  async getFacilityRequestData({
    cxId,
    facilityId,
    limit,
  }: QuestRequester & { limit?: number }): Promise<QuestBatchRequestData> {
    const facility = await this.getFacilityData(cxId, facilityId);
    const patientIds = await this.getPatientIdsForFacility({ cxId, facilityId });
    const patientIdsToFetch = limit ? patientIds.slice(0, limit) : patientIds;
    const patients = await this.getEachPatientById(cxId, patientIdsToFetch);
    return { cxId, facility, patients };
  }

  convertBatchRequestToPatientRequests(
    batchRequestData: QuestBatchRequestData
  ): QuestPatientRequestData[] {
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

  async getCustomerData(cxId: string): Promise<CustomerData> {
    return getCustomerData({ cxId }, this.axiosInstance);
  }

  async getPatientIdsForFacility({ cxId, facilityId }: QuestRequester): Promise<string[]> {
    return getPatientIdsForFacility({ cxId, facilityId }, this.axiosInstance);
  }

  async getPatient(cxId: string, patientId: string): Promise<Patient> {
    return getPatient({ cxId, patientId }, this.axiosInstance);
  }
}

import { CohortCreateCmd, CohortUpdateCmd, CohortWithSize } from "@metriport/shared/domain/cohort";
import axios from "axios";

const INTERNAL_CREATE_COHORT_ENDPOINT = "internal/cohort";
export async function createCohort({
  apiUrl,
  cxId,
  cohortData,
}: {
  apiUrl: string;
  cxId: string;
  cohortData: CohortCreateCmd;
}): Promise<string> {
  const response = await axios.post(`${apiUrl}/${INTERNAL_CREATE_COHORT_ENDPOINT}`, cohortData, {
    params: {
      cxId,
    },
  });
  return response.data.id;
}

const INTERNAL_ADD_PATIENTS_TO_COHORT_ENDPOINT = "internal/cohort";
export async function addPatientsToCohort({
  apiUrl,
  cxId,
  cohortId,
  patientIds,
}: {
  apiUrl: string;
  cxId: string;
  cohortId: string;
  patientIds: string[];
}): Promise<string> {
  const response = await axios.post(
    `${apiUrl}/${INTERNAL_ADD_PATIENTS_TO_COHORT_ENDPOINT}/${cohortId}/patient`,
    {
      patientIds,
    },
    {
      params: {
        cxId,
      },
    }
  );
  return response.data.message;
}

const INTERNAL_GET_COHORT_BY_NAME_ENDPOINT = "internal/cohort/name";
export async function getCohortByNameOrFail({
  apiUrl,
  cxId,
  cohortName,
}: {
  apiUrl: string;
  cxId: string;
  cohortName: string;
}): Promise<string> {
  const response = await axios.get(
    `${apiUrl}/${INTERNAL_GET_COHORT_BY_NAME_ENDPOINT}/${cohortName}`,
    {
      params: {
        cxId,
      },
    }
  );
  return response.data.id;
}

const INTERNAL_UPDATE_COHORT_ENDPOINT = "internal/cohort";

export async function updateCohort({
  apiUrl,
  cxId,
  cohortId,
  cohortData,
}: {
  apiUrl: string;
  cxId: string;
  cohortId: string;
  cohortData: Omit<CohortUpdateCmd, "id" | "cxId">;
}): Promise<CohortWithSize> {
  const response = await axios.patch(
    `${apiUrl}/${INTERNAL_UPDATE_COHORT_ENDPOINT}/${cohortId}`,
    cohortData,
    {
      params: {
        cxId,
      },
    }
  );
  return response.data;
}

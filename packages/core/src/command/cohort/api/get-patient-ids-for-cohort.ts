import {
  InternalCohortPatientsResponse,
  internalCohortPatientsResponseSchema,
} from "@metriport/shared/interface/internal/cohort";
import axios from "axios";
import { Config } from "../../../util/config";
import { withDefaultApiErrorHandling } from "../../shared/api/shared";
import { CohortParams, DEFAULT_PAGE_SIZE, MEDICAL_COHORT_ROUTE } from "./shared";

/**
 * Fetches all patient IDs in a cohort, handling pagination automatically.
 *
 * @param cohortId - The ID of the cohort.
 * @param cxId - The customer ID.
 * @returns The list of patient IDs in the cohort.
 */
export async function getPatientIdsForCohort({ cohortId, cxId }: CohortParams): Promise<string[]> {
  const api = axios.create();
  const patientIds: string[] = [];
  const patientIdsRoute = `${MEDICAL_COHORT_ROUTE}/${cohortId}/patient`;
  let nextPageUrl:
    | string
    | undefined = `${Config.getApiUrl()}${patientIdsRoute}?cxId=${cxId}&count=${DEFAULT_PAGE_SIZE}`;

  while (nextPageUrl) {
    const currentUrl = nextPageUrl;
    const response = await withDefaultApiErrorHandling({
      functionToRun: () => api.get<InternalCohortPatientsResponse>(currentUrl),
      messageWhenItFails: "Failure while getting patient IDs from cohort @ Api",
      additionalInfo: {
        cxId,
        cohortId,
        url: currentUrl,
        context: "cohort.getPatientIdsForCohort",
      },
    });

    const cohortPage = internalCohortPatientsResponseSchema.parse(response.data);
    patientIds.push(...cohortPage.patients.map(p => p.id));
    nextPageUrl = cohortPage.meta.nextPage;
  }

  return patientIds;
}

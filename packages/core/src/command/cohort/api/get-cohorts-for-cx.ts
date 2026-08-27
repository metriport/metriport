import {
  InternalCohortWithSizeResponse,
  InternalCohortsWithSizeResponse,
  internalCohortsWithSizeResponseSchema,
} from "@metriport/shared/interface/internal/cohort";
import axios from "axios";
import { Config } from "../../../util/config";
import { withDefaultApiErrorHandling } from "../../shared/api/shared";
import { MEDICAL_COHORT_ROUTE } from "./shared";

/**
 * Gets all cohorts for a customer.
 *
 * @param cxId - The customer ID.
 * @returns The cohorts for the customer.
 */
export async function getCohortsForCx(cxId: string): Promise<InternalCohortWithSizeResponse[]> {
  const api = axios.create({ baseURL: Config.getApiUrl() });
  const url = MEDICAL_COHORT_ROUTE;

  const response = await withDefaultApiErrorHandling({
    functionToRun: () => api.get<InternalCohortsWithSizeResponse>(url, { params: { cxId } }),
    messageWhenItFails: "Failure while getting cohorts @ Api",
    additionalInfo: {
      cxId,
      url,
      context: "cohort.getCohortsForCx",
    },
  });

  return internalCohortsWithSizeResponseSchema.parse(response.data).cohorts;
}

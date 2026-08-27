import { errorToString, executeWithNetworkRetries, MetriportError } from "@metriport/shared";
import axios from "axios";
import dayjs from "dayjs";
import duration from "dayjs/plugin/duration";
import { z } from "zod";
import { Config } from "../../../util/config";
import { out } from "../../../util/log";
import { MEDICAL_ROSTER_ROUTE, RosterParams } from "./api-shared";

dayjs.extend(duration);

const NUMBER_OF_ATTEMPTS = 3;
const BASE_DELAY = dayjs.duration({ milliseconds: 100 });

const patientIdsSchema = z.object({
  patientIds: z.array(z.string()),
  meta: z.object({
    nextPage: z.string().optional(),
  }),
});

/**
 * Retrieves the patient IDs from a roster, handling pagination.
 *
 * @param cxId - The customer ID.
 * @param rosterId - The ID of the roster to get the patient IDs from.
 * @returns The list of patient IDs.
 */
export async function getPatientIdsFromRoster({ cxId, rosterId }: RosterParams): Promise<string[]> {
  const { log } = out(`getPatientIdsFromRoster - cxId ${cxId}, rosterId ${rosterId}`);
  const api = axios.create();
  const patientIds: string[] = [];
  const patientIdsRoute = `${MEDICAL_ROSTER_ROUTE}/${rosterId}/patient`;
  let nextPageUrl: string | undefined = `${Config.getApiUrl()}${patientIdsRoute}?cxId=${cxId}`;
  try {
    while (nextPageUrl) {
      const currentUrl = nextPageUrl;
      const response = await executeWithNetworkRetries(() => api.get(currentUrl), {
        maxAttempts: NUMBER_OF_ATTEMPTS,
        initialDelay: BASE_DELAY.asMilliseconds(),
        log,
      });
      const rosterPage = patientIdsSchema.parse(response.data);
      patientIds.push(...rosterPage.patientIds);
      nextPageUrl = rosterPage.meta.nextPage;
    }
  } catch (error) {
    const msg = "Failure while getting patient IDs from roster @ Api";
    log(`${msg}. Cause: ${errorToString(error)}`);
    throw new MetriportError(msg, error, {
      cxId,
      rosterId,
      url: nextPageUrl,
      context: "roster.getPatientIdsFromRoster",
    });
  }
  return patientIds;
}

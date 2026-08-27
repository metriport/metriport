import axios from "axios";
import { Config } from "../../../util/config";
import { withDefaultApiErrorHandling } from "../../shared/api/shared";
import { MEDICAL_ROSTER_ROUTE } from "./api-shared";

export type AssignPatientsToRosterParams = {
  cxId: string;
  source: string;
  type: string;
  patientIds: string[];
};

/**
 * Assigns patients to a roster, creating the roster if it doesn't exist.
 */
export async function assignPatientsToRoster({
  cxId,
  source,
  type,
  patientIds,
}: AssignPatientsToRosterParams): Promise<void> {
  const api = axios.create({ baseURL: Config.getApiUrl() });

  await withDefaultApiErrorHandling({
    functionToRun: () =>
      api.post(
        `${MEDICAL_ROSTER_ROUTE}/assign-and-create`,
        { source, type, patientIds },
        { params: { cxId } }
      ),
    messageWhenItFails: "Failure while assigning patients to roster @ Api",
    additionalInfo: {
      cxId,
      source,
      type,
      patientCount: patientIds.length,
      url: `${MEDICAL_ROSTER_ROUTE}/assign-and-create`,
      context: "roster.assignPatientsToRoster",
    },
  });
}

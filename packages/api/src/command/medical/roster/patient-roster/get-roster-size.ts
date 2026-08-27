import { GetRosterCmd } from "@metriport/shared/domain/roster/roster";
import { PatientRosterModel } from "../../../../models/medical/patient-roster";
import { getRosterOrFail } from "../get-roster";

/**
 * Parameters for getting the size of a roster.
 *
 * @param  cxId - The customer ID.
 * @param rosterId - The roster ID.
 * @returns The size of the roster.
 * @throws NotFoundError if the roster does not exist.
 */
export async function getRosterSize({ rosterId, cxId }: GetRosterCmd): Promise<number> {
  await getRosterOrFail({ rosterId, cxId });
  const size = await PatientRosterModel.count({ where: { rosterId } });
  return size;
}

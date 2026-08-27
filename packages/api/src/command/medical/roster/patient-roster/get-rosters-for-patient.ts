import { ListRostersForPatientCmd, Roster } from "@metriport/shared";
import { RosterModel } from "../../../../models/medical/roster";

/**
 * Get the list of rosters for a patient.
 *
 * @param patientId - The ID of the patient.
 * @param cxId - The customer ID.
 * @returns The list of rosters containing the patient.
 */
export async function listRostersForPatient({
  patientId,
  cxId,
  source,
  type,
  status,
  sortBy,
  limit,
}: ListRostersForPatientCmd): Promise<Roster[]> {
  const rosters = await RosterModel.findAll({
    where: {
      cxId,
      ...(source ? { source } : {}),
      ...(type ? { type } : {}),
      ...(status ? { status } : {}),
    },
    include: [
      {
        association: RosterModel.associations.PatientRoster,
        where: { patientId },
        attributes: [],
        required: true,
      },
    ],
    ...(sortBy ? { order: [[sortBy.column, sortBy.order]] } : {}),
    ...(limit ? { limit } : {}),
  });
  return rosters.map(roster => roster.dataValues);
}

/**
 * Finds the most recently created roster that contains the given patient, filtered by the given optional criteria.
 *
 * @param cxId - The customer ID.
 * @param patientId - The patient ID.
 * @param source - The source (e.g., "surescripts", "quest").
 * @param type - The roster type (e.g., "weekly-backfill", "notifications").
 * @param status - The status of the roster (e.g., "closed", "open").
 * @returns The last roster containing the patient, or undefined if none found.
 */
export async function getLastRosterForPatient({
  cxId,
  patientId,
  source,
  type,
  status,
}: Omit<ListRostersForPatientCmd, "sortBy" | "limit">): Promise<Roster | undefined> {
  const rosters = await listRostersForPatient({
    patientId,
    cxId,
    source,
    type,
    status,
    sortBy: { column: "createdAt", order: "DESC" },
    limit: 1,
  });
  const lastRoster = rosters[0];
  if (!lastRoster) return undefined;
  return lastRoster;
}

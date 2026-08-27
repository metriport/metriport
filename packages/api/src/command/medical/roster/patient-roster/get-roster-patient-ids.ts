import { GetRosterCmd } from "@metriport/shared";
import { FindOptions, OrderItem } from "sequelize";
import {
  getPaginationFilters,
  getPaginationLimits,
  getPaginationSorting,
  Pagination,
} from "../../../../command/pagination";
import { PatientRosterModel } from "../../../../models/medical/patient-roster";
import { getRosterOrFail } from "../get-roster";

export type GetRosterCmdWithPagination = GetRosterCmd & {
  pagination?: Pagination;
};

/**
 * Get the patient IDs from a roster.
 *
 * @param rosterId - The ID of the roster to get the patient IDs from.
 * @param cxId - The customer ID.
 * @param pagination - Optional pagination parameters.
 * @returns The patient IDs from the roster.
 * @throws NotFoundError if the roster does not exist.
 */
export async function getPatientIdsOnRoster({
  rosterId,
  cxId,
  pagination,
}: GetRosterCmdWithPagination): Promise<string[]> {
  await getRosterOrFail({ rosterId, cxId });
  const findOptions: FindOptions<PatientRosterModel> = {
    where: {
      rosterId,
      ...(pagination ? getPaginationFilters(pagination, "patientId") : {}),
    },
    attributes: ["patientId"],
    ...(pagination ? getPaginationLimits(pagination) : {}),
    ...(pagination ? { order: [getPaginationSorting(pagination, "patientId") as OrderItem] } : {}),
  };
  const patientRosters = await PatientRosterModel.findAll(findOptions);
  return patientRosters.map(pr => pr.dataValues.patientId);
}

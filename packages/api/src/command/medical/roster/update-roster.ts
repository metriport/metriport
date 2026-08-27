import { Roster, UpdateRosterCmd, validateNewRosterStatus } from "@metriport/shared";
import { Transaction } from "sequelize";
import { getRosterModelOrFail } from "./get-roster";

export type UpdateRosterCmdWithTx = UpdateRosterCmd & {
  transaction?: Transaction;
};

/**
 * Updates a roster. This performs a partial update of the roster based on the provided fields.
 *
 * @param rosterId - The roster ID.
 * @param cxId - The customer ID.
 * @param status - The new status of the roster.
 * @param data - The new data of the roster.
 * @param forceStatusUpdate - Whether to force the status update (only to be used by internal flows/endpoints).
 * @param transaction - Optional transaction to use for the operation.
 * @returns the updated roster.
 * @throws BadRequestError if the closed status is not valid based on the current state.
 * @throws NotFoundError if the roster doesn't exist.
 */
export async function updateRoster({
  rosterId,
  cxId,
  status,
  data,
  forceStatusUpdate = false,
  transaction,
}: UpdateRosterCmdWithTx): Promise<Roster> {
  const rosterModel = await getRosterModelOrFail({
    rosterId,
    cxId,
    transaction,
    lock: transaction ? true : undefined,
  });
  const roster = rosterModel.dataValues;
  const currentStatus = roster.status;
  const newStatus = status
    ? forceStatusUpdate
      ? status
      : validateNewRosterStatus(currentStatus, status)
    : undefined;
  const fieldsToUpdate: Pick<UpdateRosterCmd, "status" | "data"> = {
    ...(newStatus ? { status: newStatus } : {}),
    ...(data !== undefined ? { data } : {}),
  };
  if (Object.keys(fieldsToUpdate).length < 1) return roster;
  const updatedRoster = await rosterModel.update(fieldsToUpdate, { transaction });
  return updatedRoster.dataValues;
}

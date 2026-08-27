import { uuidv7 } from "@metriport/core/util/uuid-v7";
import { CreateRosterCmd, Roster, rosterInitialStatus } from "@metriport/shared";
import { Transaction } from "sequelize";
import { RosterModel } from "../../../models/medical/roster";

export type CreateRosterCmdWithTx = CreateRosterCmd & {
  transaction?: Transaction;
};

/**
 * Creates a new roster.
 *
 * @param cxId - The customer ID.
 * @param source - The source of the roster.
 * @param rosterType - The type of the roster.
 * @param data - The data of the roster.
 * @param status - The status of the roster.
 * @param transaction - The transaction to use for the operation.
 * @returns The created roster.
 */
export async function createRoster({
  cxId,
  source,
  type,
  data,
  status = rosterInitialStatus,
  transaction,
}: CreateRosterCmdWithTx): Promise<Roster> {
  const rosterCreate = {
    id: uuidv7(),
    cxId,
    status,
    source,
    type,
    data,
  };
  const newRoster = await RosterModel.create(rosterCreate, { transaction });
  return newRoster.dataValues;
}

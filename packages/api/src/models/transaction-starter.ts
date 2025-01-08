import { Model, Transaction } from "sequelize";
import { BaseModelNoId } from "./_default";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function startTransaction<T extends Model<any, any>>(
  model: BaseModelNoId<T>
): Promise<Transaction> {
  const sequelize = model.sequelize;
  if (!sequelize) throw new Error("Missing sequelize");
  return sequelize.transaction();
}

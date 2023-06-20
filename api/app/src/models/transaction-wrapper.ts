import { Model, Transaction } from "sequelize";
import { startTransaction } from "./transaction-starter";
import { BaseModel } from "./_default";

// TODO Add unit tests

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function executeOnDBTx<T extends Model<any, any>, X>(
  model: BaseModel<T>,
  callback: (tx: Transaction) => Promise<X>
): Promise<X> {
  let transaction: Transaction | undefined = await startTransaction(model);
  try {
    return await callback(transaction);
  } catch (error) {
    await transaction.rollback();
    transaction = undefined;
    throw error;
  } finally {
    if (transaction) await transaction.commit();
  }
}

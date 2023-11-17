import { Model, Transaction } from "sequelize";
import { startTransaction } from "./transaction-starter";
import { BaseModel } from "./_default";

// TODO Add unit tests

/**
 * Function to execute a callback on a DB transaction.
 * Generally used along 'lock' on the model to avoid deadlocks.
 * This means that particular DB record is literally locked for the duration of the transaction
 * and no other connections/transactions can access it (depends on the lock type). So the
 * operations on the callback should be short lived and return as soon as possible.
 * Also, make sure to use the provided 'transaction' parameter provided in the callback
 * in all DB operations, otherwise Sequelize will use a diff connection/transaction
 * to issue those - THIS CAN CAUSE A DEADLOCK.
 */
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

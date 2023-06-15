import { Transaction } from "sequelize";
import * as transaction from "../transaction";

export function mockStartTransaction(): jest.SpyInstance {
  const tx = {
    commit: jest.fn(),
    rollback: jest.fn(),
    afterCommit: jest.fn(),
  } as unknown as Transaction;
  return jest.spyOn(transaction, "startTransaction").mockResolvedValue(tx);
}

import { PrimaryKey } from "../../external/aws/dynamodb";

export function createPrimaryKey({
  cxId,
  operation,
}: {
  cxId: string;
  operation: string;
}): PrimaryKey {
  return { cxId_operation: { S: `${cxId}_${operation}` } };
}

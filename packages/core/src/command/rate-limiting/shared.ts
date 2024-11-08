import { RateLimitOperation, RateLimit } from "@metriport/shared/src/domain/rate-limiting";
import { DdbMapping } from "../../external/aws/dynamodb";

export const secondGranularityIsoDateTime = "YYYY-MM-DDTHH:mm:ss";

type LimitSecondsMap = Map<RateLimit, number>;

export const secondsLookup: LimitSecondsMap = new Map([["operationsPerMinute", 60]]);

type LimitMap = Map<RateLimit, number>;

export const defaultPatientCreateLimits: LimitMap = new Map([["operationsPerMinute", 4]]);

export const defaultOperationLimits: Map<RateLimitOperation, LimitMap> = new Map([
  ["patientCreate", defaultPatientCreateLimits],
]);

export function createPrimaryKey({
  cxId,
  operation,
}: {
  cxId: string;
  operation: string;
}): DdbMapping {
  return { cxId_operation: createPrimaryKeyValue({ cxId, operation }) };
}

export function createPrimaryKeyValue({
  cxId,
  operation,
}: {
  cxId: string;
  operation: string;
}): string {
  return `${cxId}_${operation}`;
}

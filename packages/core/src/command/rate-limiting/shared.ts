import { RateLimitOperation, RateLimit } from "@metriport/shared/src/domain/rate-limiting";
import { DdbMapping } from "../../external/aws/dynamodb";

export const secondGranularityIsoDateTime = "YYYY-MM-DDTHH:mm:ss";

type LimitSecondsMap = Map<RateLimit, number>;

export const secondsLookup: LimitSecondsMap = new Map([["operationsPerMinute", 60]]);

export const defaultPatientQueryLimits: LimitMap = new Map([["operationsPerMinute", 10]]);
export const defaultDocumentQueryLimits: LimitMap = new Map([["operationsPerMinute", 10]]);
export const defaultConsolidateDataQueryLimits: LimitMap = new Map([["operationsPerMinute", 100]]);

type LimitMap = Map<RateLimit, number>;

export const defaultOperationLimits: Map<RateLimitOperation, LimitMap> = new Map([
  ["patientQuery", defaultPatientQueryLimits],
  ["documentQuery", defaultDocumentQueryLimits],
  ["consolidatedDataQuery", defaultConsolidateDataQueryLimits],
]);

export function createPrimaryKey({
  cxId,
  operation,
}: {
  cxId: string;
  operation: string;
}): DdbMapping {
  return { cxIdAndOperation: createPrimaryKeyValue({ cxId, operation }) };
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

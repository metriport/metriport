import { CqlTransformRequest } from "@metriport/shared/domain/cql-engine/transform";
import { generateJobId as generateJobIdUtil } from "../../../utils";

const hedisJobPrefix = "HEDIS_";

export abstract class CqlTransformHandler {
  abstract processCqlTransform(request: CqlTransformRequest): Promise<string>;

  generateJobId(): string {
    return generateJobId();
  }

  generateHedisJobId(): string {
    return generateHedisJobId();
  }

  isHedisJobId(jobId: string): boolean {
    return jobId.startsWith(hedisJobPrefix);
  }
}

export function generateJobId(): string {
  return generateJobIdUtil();
}

export function generateHedisJobId(): string {
  return `${hedisJobPrefix}${generateJobId()}`;
}

import { uuidv7 } from "@metriport/shared";

export function buildCoreExportJobId(): string {
  return uuidv7();
}

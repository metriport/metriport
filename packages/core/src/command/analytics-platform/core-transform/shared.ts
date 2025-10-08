import { uuidv7 } from "@metriport/shared";

const localEnvOutputDirectory = "/tmp/pg/output";

export function buildCoreExportJobId(): string {
  return uuidv7();
}

export function buildAnalyticsIncrementalLocalOutputDirectory(cxId: string): string {
  return `${localEnvOutputDirectory}/incremental/${cxId}`;
}

//eslint-disable-next-line @typescript-eslint/no-explicit-any
export function parseDryRun(bodyAsJson: any): boolean | undefined {
  const dryRunRaw = bodyAsJson.dryRun;
  if (dryRunRaw === undefined) return undefined;
  if (typeof dryRunRaw !== "boolean") throw new Error(`Invalid dryRun`);
  return dryRunRaw;
}

//eslint-disable-next-line @typescript-eslint/no-explicit-any
export function parseTriggerConsolidated(bodyAsJson: any): boolean | undefined {
  const triggerConsolidatedRaw = bodyAsJson.triggerConsolidated;
  if (triggerConsolidatedRaw === undefined) return undefined;
  if (typeof triggerConsolidatedRaw !== "boolean") throw new Error(`Invalid triggerConsolidated`);
  return triggerConsolidatedRaw;
}
export function parseTriggerConsolidatedOrFail(bodyAsJson: unknown): boolean {
  const triggerConsolidatedRaw = parseTriggerConsolidated(bodyAsJson);
  if (triggerConsolidatedRaw === undefined) throw new Error(`Missing triggerConsolidated`);
  return triggerConsolidatedRaw;
}

//eslint-disable-next-line @typescript-eslint/no-explicit-any
export function parseDisableWebhooks(bodyAsJson: any): boolean | undefined {
  const disableWebhooksRaw = bodyAsJson.disableWebhooks;
  if (disableWebhooksRaw === undefined) return undefined;
  if (typeof disableWebhooksRaw !== "boolean") throw new Error(`Invalid disableWebhooks`);
  return disableWebhooksRaw;
}
export function parseDisableWebhooksOrFail(bodyAsJson: unknown): boolean {
  const disableWebhooksRaw = parseDisableWebhooks(bodyAsJson);
  if (disableWebhooksRaw === undefined) throw new Error(`Missing disableWebhooks`);
  return disableWebhooksRaw;
}

//eslint-disable-next-line @typescript-eslint/no-explicit-any
export function parseRerunPdOnNewDemos(bodyAsJson: any): boolean | undefined {
  const rerunPdOnNewDemographicsRaw = bodyAsJson.rerunPdOnNewDemographics;
  if (rerunPdOnNewDemographicsRaw === undefined) return undefined;
  if (typeof rerunPdOnNewDemographicsRaw !== "boolean") {
    throw new Error(`Invalid rerunPdOnNewDemographics`);
  }
  return rerunPdOnNewDemographicsRaw;
}

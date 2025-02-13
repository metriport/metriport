//eslint-disable-next-line @typescript-eslint/no-explicit-any
export function parseCxIdAndJob(bodyAsJson: any) {
  const cxIdRaw = bodyAsJson.cxId;
  if (!cxIdRaw) throw new Error(`Missing cxId`);
  if (typeof cxIdRaw !== "string") throw new Error(`Invalid cxId`);

  const jobIdRaw = bodyAsJson.jobId;
  if (!jobIdRaw) throw new Error(`Missing jobId`);
  if (typeof jobIdRaw !== "string") throw new Error(`Invalid jobId`);

  return { cxIdRaw, jobIdRaw };
}

//eslint-disable-next-line @typescript-eslint/no-explicit-any
export function parseFacilityId(bodyAsJson: any) {
  const facilityIdRaw = bodyAsJson.facilityId;
  if (!facilityIdRaw) throw new Error(`Missing cxId`);
  if (typeof facilityIdRaw !== "string") throw new Error(`Invalid facilityId`);

  return { facilityIdRaw };
}

//eslint-disable-next-line @typescript-eslint/no-explicit-any
export function parseTriggerConsolidated(bodyAsJson: any) {
  const triggerConsolidatedRaw = bodyAsJson.triggerConsolidated;
  if (triggerConsolidatedRaw === undefined) return {};
  if (typeof triggerConsolidatedRaw !== "boolean") throw new Error(`Invalid triggerConsolidated`);
  return { triggerConsolidatedRaw };
}
export function parseTriggerConsolidatedOrFail(bodyAsJson: unknown) {
  const { triggerConsolidatedRaw } = parseTriggerConsolidated(bodyAsJson);
  if (!triggerConsolidatedRaw) throw new Error(`Missing triggerConsolidated`);
  return { triggerConsolidatedRaw };
}

//eslint-disable-next-line @typescript-eslint/no-explicit-any
export function parseDisableWebhooks(bodyAsJson: any) {
  const disableWebhooksRaw = bodyAsJson.disableWebhooks;
  if (disableWebhooksRaw === undefined) return {};
  if (typeof disableWebhooksRaw !== "boolean") throw new Error(`Invalid disableWebhooks`);
  return { disableWebhooksRaw };
}
export function parseDisableWebhooksOrFail(bodyAsJson: unknown) {
  const { disableWebhooksRaw } = parseDisableWebhooks(bodyAsJson);
  if (!disableWebhooksRaw) throw new Error(`Missing disableWebhooks`);
  return { disableWebhooksRaw };
}

//eslint-disable-next-line @typescript-eslint/no-explicit-any
export function parseRerunPdOnNewDemos(bodyAsJson: any) {
  const rerunPdOnNewDemographicsRaw = bodyAsJson.rerunPdOnNewDemographics;
  if (rerunPdOnNewDemographicsRaw === undefined) return {};
  if (typeof rerunPdOnNewDemographicsRaw !== "boolean") {
    throw new Error(`Invalid rerunPdOnNewDemographics`);
  }
  return { rerunPdOnNewDemographicsRaw };
}
export function parseRerunPdOnNewDemosOrFail(bodyAsJson: unknown) {
  const { rerunPdOnNewDemographicsRaw } = parseRerunPdOnNewDemos(bodyAsJson);
  if (!rerunPdOnNewDemographicsRaw) throw new Error(`Missing rerunPdOnNewDemographics`);
  return { rerunPdOnNewDemographicsRaw };
}

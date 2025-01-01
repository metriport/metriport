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
export function parseJobStartedAt(bodyAsJson: any) {
  const jobStartedAtRaw = bodyAsJson.jobStartedAt;
  if (!jobStartedAtRaw) throw new Error(`Missing jobStartedAt`);
  if (typeof jobStartedAtRaw !== "string") throw new Error(`Invalid jobStartedAt`);

  return { jobStartedAtRaw };
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
  if (triggerConsolidatedRaw === undefined) throw new Error(`Missing triggerConsolidated`);
  if (typeof triggerConsolidatedRaw !== "boolean") throw new Error(`Invalid triggerConsolidated`);

  return { triggerConsolidatedRaw };
}

//eslint-disable-next-line @typescript-eslint/no-explicit-any
export function parseDisableWebhooks(bodyAsJson: any) {
  const disableWebhooksRaw = bodyAsJson.disableWebhooks;
  if (disableWebhooksRaw === undefined) throw new Error(`Missing disableWebhooks`);
  if (typeof disableWebhooksRaw !== "boolean") throw new Error(`Invalid disableWebhooks`);

  return { disableWebhooksRaw };
}

//eslint-disable-next-line @typescript-eslint/no-explicit-any
export function parseRerunPdOnNewDemos(bodyAsJson: any) {
  const rerunPdOnNewDemographicsRaw = bodyAsJson.rerunPdOnNewDemographics;
  if (rerunPdOnNewDemographicsRaw === undefined)
    throw new Error(`Missing rerunPdOnNewDemographics`);
  if (typeof rerunPdOnNewDemographicsRaw !== "boolean")
    throw new Error(`Invalid rerunPdOnNewDemographics`);

  return { rerunPdOnNewDemographicsRaw };
}

import { ConsolidatedWebhookPatient } from "@metriport/shared/medical";
import { ConsolidatedWebhookRequest } from "@metriport/shared/src/medical/webhook/webhook-request";
import { Response } from "express";

let consolidatedPatientsData: ConsolidatedWebhookPatient[] | undefined = undefined;

export function getConsolidatedData(): ConsolidatedWebhookPatient[] | undefined {
  return consolidatedPatientsData;
}

export function handleConsolidated(whRequest: ConsolidatedWebhookRequest, res: Response) {
  consolidatedPatientsData = whRequest.patients as ConsolidatedWebhookPatient[];
  console.log(
    `[WH] ================> Handle Consolidated WH... ${JSON.stringify(
      consolidatedPatientsData,
      null,
      2
    )}`
  );
  return res.sendStatus(200);
}

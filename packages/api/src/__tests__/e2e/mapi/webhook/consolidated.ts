import { ConsolidatedWebhookRequest } from "@metriport/api-sdk/medical/models/webhook-request";
import { Response } from "express";
import { PayloadPatient } from "../../../../command/medical/patient/consolidated-webhook";

let consolidatedPatientsData: PayloadPatient[] | undefined = undefined;

export function getConsolidatedData(): PayloadPatient[] | undefined {
  return consolidatedPatientsData;
}

export function handleConsolidated(whRequest: ConsolidatedWebhookRequest, res: Response) {
  consolidatedPatientsData = whRequest.patients as PayloadPatient[];
  console.log(
    `[WH] ================> Handle Consolidated WH... ${JSON.stringify(
      consolidatedPatientsData,
      null,
      2
    )}`
  );
  return res.sendStatus(200);
}

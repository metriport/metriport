import { uniqBy } from "lodash";
import { Patient } from "@metriport/core/domain/medical/patient";
import { MAPIWebhookType } from "../../../domain/webhook";
import {
  GroupedValidationResult,
  PatientsWithValidationResult,
  SingleValidationResult,
} from "./check-doc-queries-shared";
import { MAPIWebhookStatus, processPatientDocumentRequest } from "./document-webhook";

type PatientToNotify = Pick<Patient, "id" | "cxId">;

export async function sendWHNotifications(
  patientsToUpdate: PatientsWithValidationResult
): Promise<void> {
  const entries = Object.entries(patientsToUpdate);

  const downloadsToNofify = entries
    .filter(([, validationResult]) => shouldNotifyAboutStatus(validationResult.download))
    .map(toNotify);
  // The docs say that the documents could be set when its a `document-download` notification
  // But it doesn't say it will alaways be the case, and we don't know what docs were part of the last doc query
  notify(downloadsToNofify, "medical.document-download");

  const conversionsToNofify = entries
    .filter(([, validationResult]) => shouldNotifyAboutStatus(validationResult.convert))
    .map(toNotify);
  notify(conversionsToNofify, "medical.document-conversion");
}

function notify(patientsToNofify: PatientToNotify[], whType: MAPIWebhookType) {
  const unique = uniqBy(patientsToNofify, p => `${p.cxId}_${p.id}`);
  unique.forEach(({ cxId, id: patientId }) => {
    processPatientDocumentRequest(cxId, patientId, whType, MAPIWebhookStatus.completed);
  });
}

function shouldNotifyAboutStatus(validationResult: SingleValidationResult): boolean {
  return validationResult === "both" || validationResult === "status";
}

function toNotify([patientId, { cxId }]: [string, GroupedValidationResult]): PatientToNotify {
  return { id: patientId, cxId };
}

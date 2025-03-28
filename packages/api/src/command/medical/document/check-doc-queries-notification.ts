import { Patient } from "@metriport/core/domain/patient";
import { uniqBy } from "lodash";
import { MAPIWebhookType } from "../../../domain/webhook";
import { GroupedValidationResult, PatientsWithValidationResult } from "./check-doc-queries-shared";
import { MAPIWebhookStatus, processPatientDocumentRequest } from "./document-webhook";

type PatientToNotify = Pick<Patient, "id" | "cxId"> & { requestId: string };

export async function sendWHNotifications(
  patientsToUpdate: PatientsWithValidationResult
): Promise<void> {
  const entries = Object.entries(patientsToUpdate);

  const downloadsToNofify = entries.map(toNotify);
  notify(downloadsToNofify, "medical.document-download");

  const conversionsToNofify = entries.map(toNotify);
  notify(conversionsToNofify, "medical.document-conversion");
}

function notify(patientsToNofify: PatientToNotify[], whType: MAPIWebhookType) {
  const unique = uniqBy(patientsToNofify, p => `${p.cxId}_${p.id}`);
  unique.forEach(({ cxId, id: patientId, requestId }) => {
    processPatientDocumentRequest({
      cxId,
      patientId,
      requestId,
      whType,
      status: MAPIWebhookStatus.completed,
    });
  });
}

function toNotify([patientId, { cxId, requestId }]: [
  string,
  GroupedValidationResult
]): PatientToNotify {
  return { id: patientId, cxId, requestId };
}

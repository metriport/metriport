import { ExternalEventData } from "@metriport/shared/interface/external/ehr/canvas/external-event";
import { EhrSources } from "@metriport/shared/interface/external/ehr/source";
import { findFirstPatientMappingForSourceOrFail } from "../../../../command/mapping/patient";
import { createCanvasClient } from "../shared";

export type SendAdtToCanvasParams = ExternalEventData & {
  cxId: string;
  patientId: string;
  practiceId: string;
};

export async function sendAdtToCanvas({
  cxId,
  patientId,
  practiceId,
  visitIdentifier,
  messageControlId,
  eventType,
  eventDatetime,
  messageDatetime,
  informationSource,
  facilityName,
  rawMessage,
}: SendAdtToCanvasParams): Promise<void> {
  const mapping = await findFirstPatientMappingForSourceOrFail({
    patientId,
    source: EhrSources.canvas,
  });
  const canvasPatientId = mapping.externalId;
  const canvasApi = await createCanvasClient({ cxId, practiceId });
  await canvasApi.createExternalEvent(cxId, {
    patient_id: canvasPatientId,
    visit_identifier: visitIdentifier,
    message_control_id: messageControlId,
    event_type: eventType,
    event_datetime: eventDatetime,
    message_datetime: messageDatetime,
    information_source: informationSource,
    facility_name: facilityName,
    raw_message: rawMessage,
  });
}

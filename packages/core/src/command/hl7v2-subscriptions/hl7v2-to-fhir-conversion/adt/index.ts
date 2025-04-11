import { Hl7Message } from "@medplum/core";
import { Resource } from "@medplum/fhirtypes";
import { MessageType } from "../msh";
import { mapEncounterAndRelatedResources } from "./encounter";

export function convertAdtNotificationToFhir(
  adt: Hl7Message,
  messageType: MessageType,
  patientId: string
): Resource[] {
  return mapEncounterAndRelatedResources(adt, messageType, patientId);
}

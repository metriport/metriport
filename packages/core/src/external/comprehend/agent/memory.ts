import { Medication, MedicationRequest, Condition, Procedure } from "@medplum/fhirtypes";

export interface ComprehendAgentMemory {
  medication: Medication[];
  medicationRequest: MedicationRequest[];
  condition: Condition[];
  procedure: Procedure[];
}

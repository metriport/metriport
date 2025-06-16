import {
  Coverage,
  Medication,
  Organization,
  Patient,
  Practitioner,
  Resource,
} from "@medplum/fhirtypes";

export interface SurescriptsContext {
  patient: Patient;
  practitioner: SystemIdentifierMap<Practitioner>;
  pharmacy: SystemIdentifierMap<Organization>;
  coverage: SystemIdentifierMap<Coverage>;
  medication: ResourceMap<Medication>;
}

export type ResourceMap<R extends Resource> = Partial<Record<keyof R, R>>;

// identifier system -> identifier value -> resource
export type SystemIdentifierMap<R extends Resource> = Record<string, IdentifierMap<R>>;
export type IdentifierMap<R extends Resource> = Record<string, R>;

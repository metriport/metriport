import { Observation, MedicationStatement, Medication } from "@medplum/fhirtypes";

export interface AugmentedResource {
  typeOid: string;
  sectionName: string;
  resource: Observation | MedicationStatement;
}
export class AugmentedObservation implements AugmentedResource {
  constructor(public typeOid: string, public sectionName: string, public resource: Observation) {}
}

export class AugmentedMedicationStatement implements AugmentedResource {
  constructor(
    public typeOid: string,
    public sectionName: string,
    public resource: MedicationStatement,
    public medication?: Medication | undefined
  ) {}
}

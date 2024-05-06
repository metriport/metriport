import {
  Observation,
  MedicationStatement,
  Medication,
  Condition,
  Resource,
} from "@medplum/fhirtypes";

export interface AugmentedResource {
  typeOid: string;
  sectionName: string;
  resource: Resource;
}
export class AugmentedObservation implements AugmentedResource {
  constructor(public typeOid: string, public sectionName: string, public resource: Observation) {}
}

export class AugmentedCondition implements AugmentedResource {
  constructor(public typeOid: string, public sectionName: string, public resource: Condition) {}
}

export class AugmentedMedicationStatement implements AugmentedResource {
  constructor(
    public typeOid: string,
    public sectionName: string,
    public resource: MedicationStatement,
    public medication?: Medication | undefined
  ) {}
}

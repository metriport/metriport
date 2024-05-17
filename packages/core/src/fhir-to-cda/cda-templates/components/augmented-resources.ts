import {
  Condition,
  Medication,
  MedicationStatement,
  Observation,
  Resource,
} from "@medplum/fhirtypes";

export interface AugmentedResource {
  readonly typeOid: string;
  readonly sectionName: string;
  resource: Resource;
}
export class AugmentedObservation implements AugmentedResource {
  constructor(public typeOid: string, public sectionName: string, public resource: Observation) {}
}

export class AugmentedCondition implements AugmentedResource {
  public readonly typeOid = "2.16.840.1.113883.10.20.22.4.3";
  constructor(public resource: Condition, public sectionName: string) {}
}

export class AugmentedMedicationStatement implements AugmentedResource {
  public readonly typeOid = "2.16.840.1.113883.10.20.22.4.16";
  constructor(
    public resource: MedicationStatement,
    public sectionName: string,
    public medication?: Medication | undefined
  ) {}
}

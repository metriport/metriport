import {
  Observation,
  MedicationStatement,
  Medication,
  Condition,
  Resource,
} from "@medplum/fhirtypes";
import { problemsSectionName } from "./problems";

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
  public readonly sectionName = problemsSectionName;
  constructor(public resource: Condition) {}
}

export class AugmentedMedicationStatement implements AugmentedResource {
  public readonly typeOid = "2.16.840.1.113883.10.20.22.4.16";
  public readonly sectionName = problemsSectionName;
  constructor(public resource: MedicationStatement, public medication?: Medication | undefined) {}
}

import {
  Condition,
  Medication,
  MedicationStatement,
  Observation,
  Resource,
} from "@medplum/fhirtypes";
import { oids } from "../constants";

export interface AugmentedResource<T extends Resource> {
  readonly sectionName: string;
  resource: T;
  readonly typeOid: string;
}
export class AugmentedObservation implements AugmentedResource<Observation> {
  constructor(
    public readonly sectionName: string,
    public readonly resource: Observation,
    public readonly typeOid: string
  ) {}
}

export class AugmentedCondition implements AugmentedResource<Condition> {
  public readonly typeOid = oids.problemConcernAct;
  constructor(public readonly sectionName: string, public readonly resource: Condition) {}
}

export class AugmentedMedicationStatement implements AugmentedResource<MedicationStatement> {
  public readonly typeOid = oids.medicationActivity;
  constructor(
    public readonly sectionName: string,
    public readonly resource: MedicationStatement,
    public readonly medication: Medication
  ) {}
}

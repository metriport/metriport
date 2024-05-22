import {
  Condition,
  Medication,
  MedicationStatement,
  Observation,
  Resource,
} from "@medplum/fhirtypes";
import { oids } from "../constants";

export interface AugmentedResource<T extends Resource> {
  readonly typeOid: string;
  readonly sectionName: string;
  resource: T;
}
export class AugmentedObservation implements AugmentedResource<Observation> {
  constructor(
    public readonly typeOid: string,
    public readonly sectionName: string,
    public readonly resource: Observation
  ) {}
}

export class AugmentedCondition implements AugmentedResource<Condition> {
  public readonly typeOid = oids.conditionType;
  constructor(public readonly sectionName: string, public readonly resource: Condition) {}
}

export class AugmentedMedicationStatement implements AugmentedResource<MedicationStatement> {
  public readonly typeOid = oids.medicationStatementType;
  constructor(
    public readonly sectionName: string,
    public readonly resource: MedicationStatement,
    public readonly medication: Medication
  ) {}
}

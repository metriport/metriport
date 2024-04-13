import { Observation } from "@medplum/fhirtypes";

export class AugmentedObservation {
  constructor(
    public typeOid: string,
    public sectionName: string,
    public observation: Observation
  ) {}
}

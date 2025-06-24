import { MedicationDispense } from "@medplum/fhirtypes";
import { ResourceCluster } from "../../bundle/resource-cluster";

export class MedicationDispenseCluster extends ResourceCluster<MedicationDispense> {
  constructor() {
    super("MedicationDispense");
  }

  protected override isEqual(
    resourceA: MedicationDispense,
    resourceB: MedicationDispense
  ): boolean {
    return resourceA.id === resourceB.id;
  }
}

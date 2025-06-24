import { Medication } from "@medplum/fhirtypes";
import { ResourceCluster } from "../../bundle/resource-cluster";
import { MedicationResourceNode } from ".";

export class MedicationCluster extends ResourceCluster<Medication> {
  constructor() {
    super("Medication");
  }

  protected override createResourceNode(resource: Medication): MedicationResourceNode {
    return new MedicationResourceNode(resource);
  }

  protected override isEqual(resourceA: Medication, resourceB: Medication): boolean {
    return resourceA.id === resourceB.id;
  }
}

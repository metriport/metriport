import { Immunization } from "@medplum/fhirtypes";
import { ResourceCluster } from "../../bundle/resource-cluster";

export class ImmunizationCluster extends ResourceCluster<Immunization> {
  constructor() {
    super("Immunization");
  }

  protected override isEqual(resourceA: Immunization, resourceB: Immunization): boolean {
    return resourceA.id === resourceB.id;
  }
}

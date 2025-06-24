import { Practitioner } from "@medplum/fhirtypes";
import { ResourceCluster } from "../../bundle/resource-cluster";

export class PractitionerCluster extends ResourceCluster<Practitioner> {
  constructor() {
    super("Practitioner");
  }

  protected override isEqual(resourceA: Practitioner, resourceB: Practitioner): boolean {
    return resourceA.id === resourceB.id;
  }
}

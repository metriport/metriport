import { Observation } from "@medplum/fhirtypes";
import { ResourceCluster } from "../../bundle/resource-cluster";

export class ObservationCluster extends ResourceCluster<Observation> {
  constructor() {
    super("Observation");
  }

  protected override isEqual(resourceA: Observation, resourceB: Observation): boolean {
    return resourceA.id === resourceB.id;
  }
}

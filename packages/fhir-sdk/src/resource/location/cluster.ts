import { Location } from "@medplum/fhirtypes";
import { ResourceCluster } from "../../bundle/resource-cluster";

export class LocationCluster extends ResourceCluster<Location> {
  constructor() {
    super("Location");
  }

  protected override isEqual(resourceA: Location, resourceB: Location): boolean {
    return resourceA.id === resourceB.id;
  }
}

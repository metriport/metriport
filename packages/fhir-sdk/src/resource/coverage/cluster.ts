import { Coverage } from "@medplum/fhirtypes";
import { ResourceCluster } from "../../bundle/resource-cluster";

export class CoverageCluster extends ResourceCluster<Coverage> {
  constructor() {
    super("Coverage");
  }

  protected override isEqual(resourceA: Coverage, resourceB: Coverage): boolean {
    return resourceA.id === resourceB.id;
  }
}

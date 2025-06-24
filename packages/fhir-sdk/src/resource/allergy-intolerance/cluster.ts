import { AllergyIntolerance } from "@medplum/fhirtypes";
import { ResourceCluster } from "../../bundle/resource-cluster";

export class AllergyIntoleranceCluster extends ResourceCluster<AllergyIntolerance> {
  constructor() {
    super("AllergyIntolerance");
  }

  protected override isEqual(
    resourceA: AllergyIntolerance,
    resourceB: AllergyIntolerance
  ): boolean {
    return resourceA.id === resourceB.id;
  }
}

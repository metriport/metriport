import { Condition } from "@medplum/fhirtypes";
import { ResourceCluster } from "../../bundle/resource-cluster";

export class ConditionCluster extends ResourceCluster<Condition> {
  constructor() {
    super("Condition");
  }

  protected override isEqual(resourceA: Condition, resourceB: Condition): boolean {
    return resourceA.id === resourceB.id;
  }
}

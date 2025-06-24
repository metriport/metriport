import { Procedure } from "@medplum/fhirtypes";
import { ResourceCluster } from "../../bundle/resource-cluster";

export class ProcedureCluster extends ResourceCluster<Procedure> {
  constructor() {
    super("Procedure");
  }

  protected override isEqual(resourceA: Procedure, resourceB: Procedure): boolean {
    return resourceA.id === resourceB.id;
  }
}

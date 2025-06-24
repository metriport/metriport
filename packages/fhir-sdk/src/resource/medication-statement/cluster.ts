import { MedicationStatement } from "@medplum/fhirtypes";
import { ResourceCluster } from "../../bundle/resource-cluster";

export class MedicationStatementCluster extends ResourceCluster<MedicationStatement> {
  constructor() {
    super("MedicationStatement");
  }

  protected override isEqual(
    resourceA: MedicationStatement,
    resourceB: MedicationStatement
  ): boolean {
    return resourceA.id === resourceB.id;
  }
}

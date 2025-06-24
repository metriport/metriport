import { FamilyMemberHistory } from "@medplum/fhirtypes";
import { ResourceCluster } from "../../bundle/resource-cluster";

export class FamilyMemberHistoryCluster extends ResourceCluster<FamilyMemberHistory> {
  constructor() {
    super("FamilyMemberHistory");
  }

  protected override isEqual(
    resourceA: FamilyMemberHistory,
    resourceB: FamilyMemberHistory
  ): boolean {
    return resourceA.id === resourceB.id;
  }
}

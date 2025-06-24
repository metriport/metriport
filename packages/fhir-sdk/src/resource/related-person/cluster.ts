import { RelatedPerson } from "@medplum/fhirtypes";
import { ResourceCluster } from "../../bundle/resource-cluster";

export class RelatedPersonCluster extends ResourceCluster<RelatedPerson> {
  constructor() {
    super("RelatedPerson");
  }

  protected override isEqual(resourceA: RelatedPerson, resourceB: RelatedPerson): boolean {
    return resourceA.id === resourceB.id;
  }
}

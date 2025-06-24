import { Organization } from "@medplum/fhirtypes";
import { ResourceCluster } from "../../bundle/resource-cluster";

export class OrganizationCluster extends ResourceCluster<Organization> {
  constructor() {
    super("Organization");
  }

  protected override isEqual(resourceA: Organization, resourceB: Organization): boolean {
    return resourceA.id === resourceB.id;
  }
}

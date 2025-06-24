import { DocumentReference } from "@medplum/fhirtypes";
import { ResourceCluster } from "../../bundle/resource-cluster";

export class DocumentReferenceCluster extends ResourceCluster<DocumentReference> {
  constructor() {
    super("DocumentReference");
  }

  protected override isEqual(resourceA: DocumentReference, resourceB: DocumentReference): boolean {
    return resourceA.id === resourceB.id;
  }
}

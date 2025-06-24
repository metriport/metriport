import { MedicationRequest } from "@medplum/fhirtypes";
import { ResourceCluster } from "../../bundle/resource-cluster";

export class MedicationRequestCluster extends ResourceCluster<MedicationRequest> {
  constructor() {
    super("MedicationRequest");
  }

  protected override isEqual(resourceA: MedicationRequest, resourceB: MedicationRequest): boolean {
    return resourceA.id === resourceB.id;
  }
}

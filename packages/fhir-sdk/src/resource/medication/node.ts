import { Medication } from "@medplum/fhirtypes";
import { ResourceNode } from "../../bundle/resource-node";

export class MedicationResourceNode extends ResourceNode<Medication> {
  constructor(resource: Medication) {
    super(resource);
  }
}

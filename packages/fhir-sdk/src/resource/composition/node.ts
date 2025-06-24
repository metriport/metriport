import { Composition } from "@medplum/fhirtypes";
import { ResourceNode } from "../../bundle/resource-node";

export class CompositionResourceNode extends ResourceNode<Composition> {
  constructor(resource: Composition) {
    super(resource);
  }
}

import { Encounter } from "@medplum/fhirtypes";
import { ResourceCluster } from "../../bundle/resource-cluster";

export class EncounterCluster extends ResourceCluster<Encounter> {
  constructor() {
    super("Encounter");
  }

  protected override isEqual(resourceA: Encounter, resourceB: Encounter): boolean {
    return resourceA.id === resourceB.id;
  }
}

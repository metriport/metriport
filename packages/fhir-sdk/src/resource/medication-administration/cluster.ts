import { MedicationAdministration } from "@medplum/fhirtypes";
import { ResourceCluster } from "../../bundle/resource-cluster";

export class MedicationAdministrationCluster extends ResourceCluster<MedicationAdministration> {
  constructor() {
    super("MedicationAdministration");
  }

  protected override isEqual(
    resourceA: MedicationAdministration,
    resourceB: MedicationAdministration
  ): boolean {
    return resourceA.id === resourceB.id;
  }
}

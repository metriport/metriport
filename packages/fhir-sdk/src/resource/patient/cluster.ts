import { Patient } from "@medplum/fhirtypes";
import { ResourceCluster } from "../../bundle/resource-cluster";

export class PatientCluster extends ResourceCluster<Patient> {
  constructor() {
    super("Patient");
  }

  protected override isEqual(a: Patient, b: Patient): boolean {
    return a.id === b.id;
  }
}

import { DiagnosticReport } from "@medplum/fhirtypes";
import { ResourceCluster } from "../../bundle/resource-cluster";

export class DiagnosticReportCluster extends ResourceCluster<DiagnosticReport> {
  constructor() {
    super("DiagnosticReport");
  }

  protected override isEqual(resourceA: DiagnosticReport, resourceB: DiagnosticReport): boolean {
    return resourceA.id === resourceB.id;
  }
}

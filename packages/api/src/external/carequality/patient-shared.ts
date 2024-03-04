import { PatientExternalDataEntry } from "@metriport/core/domain/patient";

export class PatientDataCarequality extends PatientExternalDataEntry {
  constructor(public discoveryStatus?: "processing" | "completed" | "failed") {
    super();
  }
}

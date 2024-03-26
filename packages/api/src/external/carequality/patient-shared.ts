import { PatientExternalDataEntry } from "@metriport/core/domain/patient";

export class PatientDataCarequality extends PatientExternalDataEntry {
  constructor(
    /**
     * The status of the patient discovery.
     */
    public discoveryStatus?: "processing" | "completed" | "failed",
    /**
     * The request ID for the document query triggered while the patient discovery was processing.
     */
    public scheduledDocQueryRequestId?: string | undefined
  ) {
    super();
  }
}

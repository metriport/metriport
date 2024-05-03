import { PatientExternalDataEntry } from "@metriport/core/domain/patient";

export class PatientDataCarequality extends PatientExternalDataEntry {
  constructor(
    /**
     * The status of the patient discovery.
     */
    public discoveryStatus?: "processing" | "completed" | "failed",
    /**
     * The request ID for the next patient discovery while the current patient discovery was processing.
     */
    public scheduledPdRequestId?: string | undefined,
    /**
     * The request ID for the next patient discovery while the current patient discovery was processing.
     */
    public forceDocQuery?: boolean | undefined,
    /**
     * The request ID for the document query triggered while the patient discovery was processing.
     */
    public scheduledDocQueryRequestId?: string | undefined
  ) {
    super();
  }
}

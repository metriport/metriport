import { PatientExternalDataEntry } from "@metriport/core/domain/patient";
import { LinkStatus } from "../patient-link";

export class PatientDataCarequality extends PatientExternalDataEntry {
  constructor(
    /**
     * The status of the patient discovery.
     */
    public discoveryStatus?: LinkStatus | undefined,
    /**
     * The request ID for the document query triggered while the patient discovery was processing.
     */
    public scheduledDocQueryRequestId?: string | undefined,
    /**
     * The trigger consolidated status for the document query triggered while the patient discovery was processing.
     */
    public scheduledDocQueryRequestTriggerConsolidated?: boolean | undefined,
    /**
     * The force download flag for the document query triggered while the patient discovery was processing.
     */
    public scheduledDocQueryRequestForceDownload?: boolean | undefined,
    /**
     * The start time for document retrieval.
     */
    public documentRetrievalStartTime?: Date | undefined
  ) {
    super();
  }
}

import { PatientExternalDataEntry } from "@metriport/core/domain/patient";
import { LinkStatus } from "../patient-link";

export class PatientDataCarequality extends PatientExternalDataEntry {
  constructor(
    /**
     * The start of the patient discovery.
     */
    public pdStartedAt?: Date,
    /**
     * The end of the patient discovery. Used to prevent inaccurate statistics.
     */
    public pdEndedAt?: Date,
    /**
     * The facility ID used for the patient discovery.
     */
    public pdFacilityId?: string,
    /**
     * The request ID the patient discovery.
     */
    public pdRequestId?: string,
    /**
     * The status of the patient discovery.
     */
    public discoveryStatus?: LinkStatus,
    /**
     * The request ID for the next patient discovery while the current patient discovery was processing.
     */
    public scheduledPdRequestId?: string,
    /**
     * The request ID for the next patient discovery while the current patient discovery was processing.
     */
    public scheduledPdRequestForceDocQuery?: boolean,
    /**
     * The request ID for the document query triggered while the patient discovery was processing.
     */
    public scheduledDocQueryRequestId?: string
  ) {
    super();
  }
}

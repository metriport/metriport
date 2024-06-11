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
    public scheduledDocQueryRequestId?: string | undefined
  ) {
    super();
  }
}

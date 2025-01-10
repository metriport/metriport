import { PatientExternalDataEntry } from "@metriport/core/domain/patient";
import { LinkStatus } from "../patient-link";

export class PatientDataCarequality extends PatientExternalDataEntry {
  constructor(
    /**
     * The status of the patient discovery.
     */
    public discoveryStatus?: LinkStatus | undefined,
    /**
     * The start time for document retrieval.
     */
    public documentRetrievalStartTime?: Date | undefined
  ) {
    super();
  }
}

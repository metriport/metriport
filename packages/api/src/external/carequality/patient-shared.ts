import { PatientExternalDataEntry, PatientDemoData } from "@metriport/core/domain/patient";
import { LinkStatus } from "../patient-link";
import { ScheduledPatientDiscovery } from "../hie/schedule-patient-discovery";

export class PatientDataCarequality extends PatientExternalDataEntry {
  constructor(
    /**
     * The status of the patient discovery.
     */
    public discoveryStatus?: LinkStatus | undefined,
    /**
     * The request ID of the patient discovery.
     */
    public discoveryRequestId?: string,
    /**
     * The facility ID of the patient discovery.
     */
    public discoveryFacilityId?: string,
    /**
     * The start date of the patient discovery.
     */
    public discoveryStartedAt?: Date,
    /**
     * The flag for determining whether to re-run patient discovery once if new demographic data is found.
     */
    public rerunPdOnNewDemographics?: boolean,
    /**
     * The most recent payload used for patient demographic augmentation.
     */
    public augmentedDemographics?: PatientDemoData,
    /**
     * The request payload for the next patient discovery triggered while the patient discovery was processing.
     */
    public scheduledPdRequest?: ScheduledPatientDiscovery,
    /**
     * The request ID for the document query triggered while the patient discovery was processing.
     */
    public scheduledDocQueryRequestId?: string | undefined
  ) {
    super();
  }
}

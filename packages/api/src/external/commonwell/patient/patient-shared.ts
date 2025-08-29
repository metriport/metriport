// import { Person as CommonwellPerson } from "@metriport/commonwell-sdk-v1";
import { GenderCodes } from "@metriport/commonwell-sdk";
import { GenderAtBirth, PatientExternalDataEntry } from "@metriport/core/domain/patient";
import { LinkStatus } from "../../patient-link";

/** @deprecated */
export const cqLinkStatus = ["unlinked", "processing", "linked"] as const;

/**
 * Status of the patient's link to CareQuality.
 * @deprecated
 */
export type CQLinkStatus = (typeof cqLinkStatus)[number];

export class PatientDataCommonwell extends PatientExternalDataEntry {
  constructor(
    public patientId: string,
    public personId?: string | undefined,
    public status?: LinkStatus | undefined,
    /** @deprecated */
    public cqLinkStatus?: CQLinkStatus,
    public scheduledDocQueryRequestId?: string | undefined,
    public scheduledDocQueryRequestTriggerConsolidated?: boolean | undefined
  ) {
    super();
  }
}

// export type FindOrCreatePersonResponse = { personId: string; person: CommonwellPerson } | undefined;

export function cwGenderToPatientGender(gender: GenderCodes | undefined): GenderAtBirth {
  switch (gender) {
    case GenderCodes.F:
      return "F";
    case GenderCodes.M:
      return "M";
    case GenderCodes.O:
      return "O";
    case GenderCodes.U:
      return "U";
    default:
      return "U";
  }
}

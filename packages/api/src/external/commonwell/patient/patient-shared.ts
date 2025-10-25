import { GenderCodes } from "@metriport/commonwell-sdk";
import { GenderAtBirth, PatientExternalDataEntry } from "@metriport/core/domain/patient";
import { LinkStatus } from "../../patient-link";

export class PatientDataCommonwell extends PatientExternalDataEntry {
  constructor(
    public patientId: string,
    public personId?: string | undefined,
    public status?: LinkStatus | undefined,
    public scheduledDocQueryRequestId?: string | undefined,
    public scheduledDocQueryRequestTriggerConsolidated?: boolean | undefined,
    public scheduledDocQueryRequestForceDownload?: boolean | undefined
  ) {
    super();
  }
}

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

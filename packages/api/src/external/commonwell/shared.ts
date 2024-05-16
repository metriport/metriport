import { Patient } from "@metriport/core/domain/patient";
import { MedicalDataSource } from "@metriport/core/external/index";
import { getHieInitiator, HieInitiator } from "../hie/get-hie-initiator";

export async function getCwInitiator(
  patient: Pick<Patient, "id" | "cxId">,
  facilityId?: string
): Promise<HieInitiator> {
  return getHieInitiator(patient, facilityId, MedicalDataSource.COMMONWELL);
}

export function buildCwOrgName(
  vendorName: string,
  orgName: string,
  isProvider: boolean,
  oboOid?: string | null
): string {
  if (oboOid && !isProvider) {
    return `${vendorName} - ${orgName} -OBO- ${oboOid}`;
  }
  return `${vendorName} - ${orgName}`;
}

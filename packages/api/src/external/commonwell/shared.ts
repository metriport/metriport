import { Patient } from "@metriport/core/domain/patient";
import { MedicalDataSource } from "@metriport/core/external/index";
import { getHieInitiator, HieInitiator } from "../hie/get-hie-initiator";

export async function getCwInitiator(
  patient: Pick<Patient, "id" | "cxId">,
  facilityId?: string
): Promise<HieInitiator> {
  return getHieInitiator(patient, facilityId, MedicalDataSource.COMMONWELL);
}

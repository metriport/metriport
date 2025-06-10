import { Patient } from "@metriport/shared/domain/patient";
import { CustomerData, FacilityData } from "@metriport/shared/domain/customer";

export interface QuestRequestData {
  cxId: string;
  customer: CustomerData;
  facility: FacilityData;
  patient: Patient[];
}

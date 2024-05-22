import { makeFacility } from "../../../../domain/medical/__tests__/facility";
import { FacilityUpdateCmd } from "../update-facility";

export function makeFacilityUpdateCmd(params: Partial<FacilityUpdateCmd> = {}): FacilityUpdateCmd {
  return {
    ...makeFacility(params),
  };
}

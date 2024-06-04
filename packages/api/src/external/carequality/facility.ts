import { Facility, isOboFacility } from "../../domain/medical/facility";

export function isCqOboFacility(facility: Facility): boolean {
  if (isOboFacility(facility.cqType)) {
    return facility.cqActive && facility.cqOboOid != null;
  }
  return false;
}

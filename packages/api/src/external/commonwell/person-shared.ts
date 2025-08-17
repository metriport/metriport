import { Person } from "@metriport/commonwell-sdk";

export function isEnrolledBy(orgName: string, person: Person): boolean {
  return person?.enrollmentSummary?.enroller === orgName;
}

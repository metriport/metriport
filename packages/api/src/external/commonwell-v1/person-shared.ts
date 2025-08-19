import { Person } from "@metriport/commonwell-sdk-v1";

export function isEnrolledBy(orgName: string, person: Person): boolean {
  return person?.enrollmentSummary?.enroller === orgName;
}

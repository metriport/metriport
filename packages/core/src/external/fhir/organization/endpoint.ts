import { Endpoint, Organization } from "@medplum/fhirtypes";
import { isEndpoint } from "../shared";

export function getEndpoints(entry: Organization): Endpoint[] {
  return entry.contained?.flatMap(c => (isEndpoint(c) ? c : [])) ?? [];
}

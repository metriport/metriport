export function getPatientEndpoint(orgId: string) {
  return `/v2/org/${orgId}/Patient`;
}

export function getPatientLinkEndpoint(orgId: string) {
  return `/v2/org/${orgId}/PatientLink`;
}

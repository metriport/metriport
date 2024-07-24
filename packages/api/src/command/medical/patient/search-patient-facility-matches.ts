type PatientFacilityMatchStatus = {
  name: string;
  oid: string;
  status: string;
};

// TODO #2058: Implement this function when we prioritize the feature
export async function searchPatientFacilityMatches(): Promise<PatientFacilityMatchStatus[]> {
  return [];
}

import { Bundle, Organization } from "@medplum/fhirtypes";

export type Input = {
  cxId: string;
  patientId: string;
  docId: string;
  organization: Organization;
  bundle: Bundle;
};

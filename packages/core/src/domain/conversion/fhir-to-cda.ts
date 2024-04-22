import { Organization } from "@medplum/fhirtypes";
import { Bundle } from "../../util/fhir";

export type Input = {
  cxId: string;
  patientId: string;
  bundle: Bundle;
  organization: Organization;
};

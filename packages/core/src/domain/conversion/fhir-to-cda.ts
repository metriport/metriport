import { Bundle } from "@medplum/fhirtypes";

export type Input = {
  cxId: string;
  patientId: string;
  bundle: Bundle;
  orgOid: string;
};

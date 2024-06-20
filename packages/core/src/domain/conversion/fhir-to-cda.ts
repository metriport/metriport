import { Bundle } from "@medplum/fhirtypes";

export type Input = {
  cxId: string;
  toSplit: boolean;
  bundle: Bundle;
  orgOid: string;
};

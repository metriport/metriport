import { Bundle } from "@medplum/fhirtypes";

export type Input = {
  cxId: string;
  splitCompositions: boolean;
  bundle: Bundle;
  orgOid: string;
  isCustodian?: boolean;
};

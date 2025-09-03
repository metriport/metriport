import { PatientExistingLink, PatientProbableLink } from "@metriport/commonwell-sdk";

export type NetworkLink =
  | (PatientExistingLink & { type: "existing" })
  | (PatientProbableLink & { type: "probable" });

import { LinkPatientsCommand } from "../management/link-patients";

export type Input =
  | (LinkPatientsCommand & { done: false })
  | (Pick<LinkPatientsCommand, "cxId" | "patientIds"> & { done: true });

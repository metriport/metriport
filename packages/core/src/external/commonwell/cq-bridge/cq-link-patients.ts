import { LinkPatientsCommand } from "../management/link-patients";

export type ChunkProgress = { chunkIndex?: number | undefined; chunkTotal?: number | undefined };

export type Input =
  | (LinkPatientsCommand & { done: false } & ChunkProgress)
  | (Pick<LinkPatientsCommand, "cxId" | "patientIds"> & {
      done: true;
      startedAt?: number; // when the process started
    } & ChunkProgress);

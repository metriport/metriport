import { MedicalDataSource } from ".";

export type LinkStatus = "completed" | "processing" | "failed";

export type LinkStatusAcrossHIEs = { [k in MedicalDataSource]: LinkStatus };

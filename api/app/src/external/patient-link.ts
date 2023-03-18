import { MedicalDataSource } from ".";

export type LinkStatus = "linked" | "needs-review";

export type LinkStatusAcrossHIEs = { [k in MedicalDataSource]: LinkStatus };
